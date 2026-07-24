import type { SupabaseClient } from "@supabase/supabase-js";

import { ApiError } from "@/lib/api/response";

// The candidate was claimed into regenerating_crop by claimCropApproval();
// this is the sole place it becomes worker-visible again, transitioning to
// extracting only now that the regenerated crop has actually been uploaded,
// so the background worker never extracts from a stale crop.
export async function finalizeCropApproval(
  admin: SupabaseClient,
  userId: string,
  jobId: string,
  candidateId: string,
  cropAssetMetadata: unknown,
) {
  const { data, error } = await admin
    .from("import_job_candidates")
    .update({ status: "extracting", crop_asset_metadata: cropAssetMetadata })
    .eq("id", candidateId)
    .eq("job_id", jobId)
    .eq("user_id", userId)
    .eq("status", "regenerating_crop")
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data)
    throw new ApiError(409, "invalid_candidate_state", "The crop approval was interrupted.");

  await admin
    .from("import_jobs")
    .update({ status: "extracting", progress: 45 })
    .eq("id", jobId)
    .eq("user_id", userId);

  return data;
}
