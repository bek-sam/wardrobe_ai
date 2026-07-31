import { createAdminClient } from "@/lib/supabase/admin";

import { processClaimedVisualizationJob } from "./process-claimed-job";
import type { VisualizationJobRow } from "./types";

/**
 * Small claim size: each job is an image generation plus a vision assessment
 * plus a localization call, so total processing time per job is both long and
 * unpredictable and a large batch would strand leases.
 */
const CLAIM_LIMIT = 2;
const LEASE_SECONDS = 600;

/**
 * Claims a small batch of queued/failed visualization jobs and renders each
 * one, stopping before the caller's execution budget runs out rather than
 * running the last job late and blowing the route's maxDuration. Never runs on
 * the request path.
 */
export async function processVisualizationBatch(startedAt: number, budgetMs: number) {
  if (Date.now() - startedAt > budgetMs) {
    return { claimed: 0, completed: 0, failed: 0, superseded: 0, skipped: 0 };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_outfit_visualization_jobs", {
    p_limit: CLAIM_LIMIT,
    p_lease_seconds: LEASE_SECONDS,
    p_locked_by: "visualization-worker",
  });
  if (error) throw error;

  const jobs = (Array.isArray(data) ? data : data ? [data] : []) as VisualizationJobRow[];
  let completed = 0;
  let failed = 0;
  let superseded = 0;
  let skipped = 0;

  for (const job of jobs) {
    if (Date.now() - startedAt > budgetMs) {
      // Leave the rest to their leases: the claim RPC only takes jobs whose
      // lease has expired, so the next invocation picks them back up.
      skipped = jobs.length - completed - failed - superseded;
      break;
    }
    const outcome = await processClaimedVisualizationJob(admin, job);
    if (outcome === "completed") completed += 1;
    else if (outcome === "failed") failed += 1;
    else superseded += 1;
  }

  return { claimed: jobs.length, completed, failed, superseded, skipped };
}
