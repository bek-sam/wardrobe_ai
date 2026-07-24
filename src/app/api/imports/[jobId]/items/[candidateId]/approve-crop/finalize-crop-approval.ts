import type { SupabaseClient } from "@supabase/supabase-js";

import { ApiError } from "@/lib/api/response";

// The status transition already happened atomically in claimCropApproval();
// this just records the regenerated crop's metadata once it's available.
export async function finalizeCropApproval(
  admin: SupabaseClient,
  userId: string,
  jobId: string,
  candidateId: string,
  cropAssetMetadata: unknown,
) {
  const { data, error } = await admin
    .from("import_job_candidates")
    .update({ crop_asset_metadata: cropAssetMetadata })
    .eq("id", candidateId)
    .eq("job_id", jobId)
    .eq("user_id", userId)
    .eq("status", "extracting")
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
