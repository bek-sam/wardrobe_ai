import { getServerEnvironment } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";

import { processClaimedOutfitPreviewJob } from "./process-claimed-job";
import type { OutfitPreviewJobRow } from "./types";

/**
 * Claims a batch of queued/failed outfit_preview_jobs and renders each one.
 * Never runs on the request path -- only from the internal worker route.
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
    const outcome = await processClaimedOutfitPreviewJob(admin, environment, job);
    if (outcome === "completed") completed += 1;
    else if (outcome === "failed") failed += 1;
    else superseded += 1;
  }

  return { claimed: jobs.length, completed, failed, superseded };
}
