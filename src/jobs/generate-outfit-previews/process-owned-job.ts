import { getServerEnvironment } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";

import { processClaimedOutfitPreviewJob } from "./process-claimed-job";
import type { OutfitPreviewJobRow } from "./types";

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
