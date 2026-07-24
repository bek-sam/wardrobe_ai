import type { SupabaseClient } from "@supabase/supabase-js";

import { ApiError } from "@/lib/api/response";

export async function advanceCandidateStatus(
  admin: SupabaseClient,
  userId: string,
  jobId: string,
  candidateId: string,
  cropAssetMetadata: unknown,
) {
  const { data, error } = await admin
    .from("import_job_candidates")
    .update({
      status: "extracting",
      crop_approved_at: new Date().toISOString(),
      crop_asset_metadata: cropAssetMetadata,
    })
    .eq("id", candidateId)
    .eq("job_id", jobId)
    .eq("user_id", userId)
    .eq("status", "review_crop")
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data)
    throw new ApiError(409, "invalid_candidate_state", "The crop is not awaiting approval.");

  await admin
    .from("import_jobs")
    .update({ status: "extracting", progress: 45 })
    .eq("id", jobId)
    .eq("user_id", userId);

  return data;
}
