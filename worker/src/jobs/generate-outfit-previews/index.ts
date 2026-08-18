import { getServerEnvironment } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { outfitCombinationKey } from "@/lib/recommendation";
import type { AdminClient, OutfitPreviewJobRow, ServerEnvironment } from "./contracts";
import { processClaimedOutfitPreviewJob } from "./process-claimed-job";

export {
  MissingCutoutError,
  retryAt,
  type AdminClient,
  type CandidateMemberRow,
  type OutfitPreviewJobRow,
  type PreviewJobOutcome,
  type ServerEnvironment,
} from "./contracts";

async function matchOutfitToCandidateAndEnqueue(
  admin: AdminClient,
  userId: string,
  outfitId: string,
  reason: "tomorrow_plan" | "user_saved",
  environment: ServerEnvironment,
) {
  const { data: outfitItemRows } = await admin
    .from("outfit_items")
    .select("item_id")
    .eq("user_id", userId)
    .eq("outfit_id", outfitId);
  const itemIds = (outfitItemRows ?? []).map((row) => row.item_id as string);
  if (itemIds.length === 0) return;

  const combinationKey = outfitCombinationKey(itemIds);
  const { data: candidate } = await admin
    .from("outfit_candidates")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .eq("combination_key", combinationKey)
    .maybeSingle();
  // Scoped only to the compiled library: a fully custom outfit with no
  // matching candidate row is skipped rather than backfilling one here.
  if (!candidate) return;

  await admin.rpc("enqueue_outfit_preview_job", {
    p_user_id: userId,
    p_candidate_id: candidate.id,
    p_priority_reason: reason,
    p_max_queued_per_user: environment.PREVIEW_MAX_QUEUED_PER_USER,
  });
}

async function sweepFrequentCandidates(admin: AdminClient, environment: ServerEnvironment) {
  const { data: frequentRows } = await admin
    .from("outfit_candidates")
    .select("id, user_id")
    .eq("status", "active")
    .eq("preview_status", "none")
    .gte("times_suggested", environment.PREVIEW_FREQUENTLY_SUGGESTED_THRESHOLD)
    .limit(50);
  for (const row of frequentRows ?? []) {
    try {
      await admin.rpc("enqueue_outfit_preview_job", {
        p_user_id: row.user_id,
        p_candidate_id: row.id,
        p_priority_reason: "frequently_suggested",
        p_max_queued_per_user: environment.PREVIEW_MAX_QUEUED_PER_USER,
      });
    } catch {
      // Best-effort; one bad row must never block the rest of the sweep.
    }
  }
}

async function sweepTomorrowPlans(admin: AdminClient, environment: ServerEnvironment) {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1_000).toISOString().slice(0, 10);
  const { data: planRows } = await admin
    .from("outfit_plans")
    .select("user_id, outfit_id")
    .eq("planned_date", tomorrow)
    .eq("status", "planned")
    .not("outfit_id", "is", null)
    .limit(200);
  for (const plan of planRows ?? []) {
    await matchOutfitToCandidateAndEnqueue(
      admin,
      plan.user_id as string,
      plan.outfit_id as string,
      "tomorrow_plan",
      environment,
    ).catch(() => {});
  }
}

async function sweepSavedOutfits(admin: AdminClient, environment: ServerEnvironment) {
  const since = new Date(Date.now() - 2 * 24 * 60 * 60 * 1_000).toISOString();
  const { data: savedOutfits } = await admin
    .from("outfits")
    .select("id, user_id")
    .eq("source", "user")
    .gte("created_at", since)
    .limit(200);
  for (const outfit of savedOutfits ?? []) {
    await matchOutfitToCandidateAndEnqueue(
      admin,
      outfit.user_id as string,
      outfit.id as string,
      "user_saved",
      environment,
    ).catch(() => {});
  }
}

/**
 * Best-effort daily sweep for preview priority rules 2-4 (user-saved
 * outfits, tomorrow's planned outfit, and frequently-suggested-without-a-
 * preview candidates). Idempotent on repeat calls: enqueue_outfit_preview_job
 * already dedupes/suppresses when a fresh preview exists or one is already
 * queued, so calling this at the top of every worker invocation needs no
 * separate daily cron of its own. Every step swallows its own errors so one
 * bad row never blocks the others or the worker's core claim/process loop.
 */
export async function enqueueScheduledPreviewJobs(
  admin: AdminClient,
  environment: ServerEnvironment,
) {
  await sweepTomorrowPlans(admin, environment);
  await sweepSavedOutfits(admin, environment);
  await sweepFrequentCandidates(admin, environment);
}

// Smaller than the wardrobe-compilation worker's claim size (5): each job
// here can include several image downloads plus a private AI image-generation
// call, so a batch's total processing time is far less predictable and a
// smaller lease-vs-processing-time skew window matters more.
const PREVIEW_CLAIM_LIMIT = 3;

const PREVIEW_LEASE_SECONDS = 300;

/**
 * Claims a small batch of queued/failed outfit_preview_jobs and renders each
 * one, stopping before the caller's execution budget runs out instead of
 * processing every claimed job regardless of elapsed time -- mirrors
 * claim-and-process-jobs.ts's per-job budget check. Never runs on the
 * request path -- only from the internal worker route.
 */
export async function processOutfitPreviewBatch(startedAt: number, budgetMs: number) {
  if (Date.now() - startedAt > budgetMs) {
    // Budget already gone before claiming -- skip the RPC entirely instead
    // of claiming a batch of 300s leases only to mark them all skipped, which
    // would otherwise strand those leases idle for up to 5 minutes.
    return { claimed: 0, completed: 0, failed: 0, superseded: 0, skipped: 0 };
  }

  const admin = createAdminClient();
  const environment = getServerEnvironment();
  const { data, error } = await admin.rpc("claim_outfit_preview_jobs", {
    p_limit: PREVIEW_CLAIM_LIMIT,
    p_lease_seconds: PREVIEW_LEASE_SECONDS,
  });
  if (error) throw error;

  const jobs = (Array.isArray(data) ? data : data ? [data] : []) as OutfitPreviewJobRow[];
  let completed = 0;
  let failed = 0;
  let superseded = 0;
  let skipped = 0;

  for (const job of jobs) {
    if (Date.now() - startedAt > budgetMs) {
      // Leave the remaining claimed jobs' leases to expire naturally --
      // claim_outfit_preview_jobs() only claims locked_until <= now(), so the
      // next invocation (or a concurrent worker) picks them back up instead
      // of this one running them late and risking the route's maxDuration.
      skipped = jobs.length - completed - failed - superseded;
      break;
    }
    const outcome = await processClaimedOutfitPreviewJob(admin, environment, job);
    if (outcome === "completed") completed += 1;
    else if (outcome === "failed") failed += 1;
    else superseded += 1;
  }

  return { claimed: jobs.length, completed, failed, superseded, skipped };
}

/**
 * Renders a single job already claimed via claim_owned_outfit_preview_job --
 * the interactive counterpart to processOutfitPreviewBatch. Lets a request
 * from the owning user process their own just-enqueued preview synchronously
 * so it completes without a scheduler calling the internal worker route.
 * Re-selects the row by id (scoped to expectedUserId) rather than trusting
 * data returned by the RPC, mirroring processResearchRun.
 */
export async function processOwnedOutfitPreviewJob(jobId: string, expectedUserId: string) {
  const admin = createAdminClient();
  const environment = getServerEnvironment();
  const { data, error } = await admin
    .from("outfit_preview_jobs")
    .select("id, user_id, candidate_id, source_hash, attempt_count")
    .eq("id", jobId)
    .eq("user_id", expectedUserId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Outfit preview job not found.");
  const outcome = await processClaimedOutfitPreviewJob(
    admin,
    environment,
    data as OutfitPreviewJobRow,
  );
  return { jobId, candidateId: data.candidate_id as string, outcome };
}
