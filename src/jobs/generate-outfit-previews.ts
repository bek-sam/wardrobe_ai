import { randomUUID } from "node:crypto";

import { generateModeledPreview } from "@/lib/ai/image-service";
import { buildOutfitPreviewPrompt } from "@/lib/ai/prompts/outfit-preview";
import { getServerEnvironment } from "@/lib/env/server";
import { outfitCombinationKey } from "@/lib/recommendation";
import { downloadPrivateObject, uploadPrivateObject } from "@/lib/storage/private-images";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;
type ServerEnvironment = ReturnType<typeof getServerEnvironment>;

type OutfitPreviewJobRow = {
  id: string;
  user_id: string;
  candidate_id: string;
  source_hash: string;
  attempt_count: number;
};

type CandidateMemberRow = { item_id: string; role: string; sort_order: number };

// Mirrors retryAt() in process-storage-deletions.ts / compile-wardrobe.ts.
function retryAt(attemptCount: number) {
  const delaySeconds = Math.min(60 * 60, 30 * 2 ** Math.max(0, attemptCount - 1));
  return new Date(Date.now() + delaySeconds * 1_000).toISOString();
}

// Distinguished from a generic failure: a manually-added item (or one
// imported but never approved through cutout review) has no 'cutout' image
// and never will unless the user re-imports it through the photo pipeline --
// retrying this job on a backoff schedule would never succeed, so the caller
// treats it as terminal instead of scheduling a retry.
class MissingCutoutError extends Error {
  constructor(readonly itemId: string) {
    super(`No cutout image found for item ${itemId}.`);
    this.name = "MissingCutoutError";
  }
}

async function loadPrimaryCutout(
  admin: AdminClient,
  userId: string,
  itemId: string,
): Promise<Buffer> {
  const { data } = await admin
    .from("wardrobe_item_images")
    .select("bucket_id, storage_path")
    .eq("user_id", userId)
    .eq("item_id", itemId)
    .eq("kind", "cutout")
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) throw new MissingCutoutError(itemId);
  return downloadPrivateObject(
    admin,
    data.bucket_id as string,
    data.storage_path as string,
    userId,
  );
}

/**
 * Claims a batch of queued/failed outfit_preview_jobs and renders each one:
 * validates the candidate is still active and the user still has active
 * consent + a daily quota budget, downloads the identity reference + each
 * member item's cutout, calls the (already-existing, now multi-garment)
 * generateModeledPreview(), and stores the result under
 * wardrobe-generated/{userId}/{candidateId}/preview-{uuid}.png. Never runs on
 * the request path -- only from the internal worker route.
 */
export async function processOutfitPreviewBatch(limit = 10) {
  const admin = createAdminClient();
  const environment = getServerEnvironment();
  const { data, error } = await admin.rpc("claim_outfit_preview_jobs", {
    p_limit: limit,
    p_lease_seconds: 300,
  });
  if (error) throw error;

  const jobs = (Array.isArray(data) ? data : data ? [data] : []) as OutfitPreviewJobRow[];
  let completed = 0;
  let failed = 0;
  let superseded = 0;

  for (const job of jobs) {
    try {
      const { data: candidate } = await admin
        .from("outfit_candidates")
        .select("id, status, outfit_candidate_items(item_id, role, sort_order)")
        .eq("id", job.candidate_id)
        .eq("user_id", job.user_id)
        .maybeSingle();
      const memberRows = ((candidate?.outfit_candidate_items ?? []) as CandidateMemberRow[])
        .slice()
        .sort((first, second) => first.sort_order - second.sort_order);
      if (!candidate || candidate.status !== "active" || memberRows.length === 0) {
        await admin.from("outfit_preview_jobs").update({ status: "superseded" }).eq("id", job.id);
        superseded += 1;
        continue;
      }

      const { data: profile } = await admin
        .from("profiles")
        .select("modeled_preview_consent, identity_reference_path")
        .eq("id", job.user_id)
        .maybeSingle();
      if (!profile?.modeled_preview_consent || !profile.identity_reference_path) {
        await admin.rpc("fail_outfit_preview_job", {
          p_job_id: job.id,
          p_user_id: job.user_id,
          p_error_code: "consent_not_active",
          p_error_message: "Modeled preview consent is not active.",
          p_next_attempt_at: null,
        });
        continue;
      }

      const { data: quota } = await admin.rpc("service_check_and_increment_usage_window", {
        p_user_id: job.user_id,
        p_feature: "outfit_preview_generation",
        p_limit: environment.PREVIEW_DAILY_LIMIT,
        p_period: "day",
        p_increment: 1,
      });
      if (!(quota as { allowed?: boolean } | null)?.allowed) {
        await admin.rpc("fail_outfit_preview_job", {
          p_job_id: job.id,
          p_user_id: job.user_id,
          p_error_code: "daily_preview_limit_reached",
          p_error_message: "Daily preview generation limit reached.",
          p_next_attempt_at: retryAt(job.attempt_count),
        });
        failed += 1;
        continue;
      }

      const { data: itemRows } = await admin
        .from("wardrobe_items")
        .select("id, category, color_names, pattern")
        .eq("user_id", job.user_id)
        .in(
          "id",
          memberRows.map((member) => member.item_id),
        );
      const itemsById = new Map((itemRows ?? []).map((row) => [row.id as string, row]));

      const identityReference = await downloadPrivateObject(
        admin,
        environment.PROFILE_REFERENCES_BUCKET,
        profile.identity_reference_path as string,
        job.user_id,
      );
      const garmentCutouts = await Promise.all(
        memberRows.map((member) => loadPrimaryCutout(admin, job.user_id, member.item_id)),
      );
      const prompt = buildOutfitPreviewPrompt(
        memberRows.map((member) => {
          const item = itemsById.get(member.item_id);
          return {
            role: member.role,
            category: (item?.category as string | undefined) ?? "garment",
            colorNames: (item?.color_names as string[] | undefined) ?? [],
            pattern: (item?.pattern as string | null | undefined) ?? null,
          };
        }),
      );
      const previewBytes = await generateModeledPreview({
        userId: job.user_id,
        identityReference,
        garmentCutouts,
        prompt,
      });

      const path = `${job.user_id}/${job.candidate_id}/preview-${randomUUID()}.png`;
      await uploadPrivateObject(
        admin,
        environment.WARDROBE_GENERATED_BUCKET,
        path,
        job.user_id,
        previewBytes,
        "image/png",
      );
      await admin.rpc("finalize_outfit_preview_job", {
        p_job_id: job.id,
        p_user_id: job.user_id,
        p_bucket: environment.WARDROBE_GENERATED_BUCKET,
        p_storage_path: path,
        p_source_hash: job.source_hash,
        p_model: environment.OPENAI_IMAGE_MODEL ?? "unconfigured",
      });
      completed += 1;
    } catch (error) {
      failed += 1;
      const isMissingCutout = error instanceof MissingCutoutError;
      console.error("Outfit preview generation failed", {
        jobId: job.id,
        candidateId: job.candidate_id,
        errorCode: isMissingCutout ? "missing_cutout" : "preview_generation_failed",
        message: error instanceof Error ? error.message : String(error),
      });
      try {
        await admin.rpc("fail_outfit_preview_job", {
          p_job_id: job.id,
          p_user_id: job.user_id,
          p_error_code: isMissingCutout ? "missing_cutout" : "preview_generation_failed",
          p_error_message: isMissingCutout
            ? "One or more items in this outfit has no approved cutout image yet."
            : "Modeled preview generation failed.",
          // A missing cutout will never resolve on its own -- don't burn the
          // retry budget on a job that can't succeed until the user re-imports
          // the item through the photo pipeline.
          p_next_attempt_at: isMissingCutout ? null : retryAt(job.attempt_count),
        });
      } catch {
        // Best-effort failure bookkeeping; never let this escape the loop.
      }
    }
  }

  return { claimed: jobs.length, completed, failed, superseded };
}

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
