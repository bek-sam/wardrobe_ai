import { getServerEnvironment } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";

import { processClaimedOutfitPreviewJob } from "./process-claimed-job";
import type { OutfitPreviewJobRow } from "./types";

// Smaller than the wardrobe-compilation worker's claim size (5): each job
// here can include several image downloads plus an OpenAI image-generation
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
