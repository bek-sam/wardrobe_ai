import type { SupabaseClient } from "@supabase/supabase-js";

import { ApiError } from "@/lib/api/response";

import { revertCropApprovalClaim } from "./revert-crop-approval-claim";

// Atomically claims the review_crop -> extracting transition before any
// quota is spent or real regeneration work happens, so two simultaneous
// approve-crop requests can't both consume quota/do the image work and have
// only one win at the end -- the loser gets 409 immediately here, quota
// untouched.
export async function claimCropApproval(
  admin: SupabaseClient,
  userId: string,
  jobId: string,
  candidateId: string,
) {
  const { data: claimed, error } = await admin
    .from("import_job_candidates")
    .update({ status: "extracting", crop_approved_at: new Date().toISOString() })
    .eq("id", candidateId)
    .eq("job_id", jobId)
    .eq("user_id", userId)
    .eq("status", "review_crop")
    .select("bounding_box, crop_storage_path")
    .maybeSingle();
  if (error) throw error;
  if (!claimed)
    throw new ApiError(409, "invalid_candidate_state", "The crop is not awaiting approval.");
  if (!claimed.crop_storage_path) {
    await revertCropApprovalClaim(admin, userId, jobId, candidateId);
    throw new ApiError(409, "invalid_candidate_state", "The crop is missing.");
  }

  const { data: job, error: jobError } = await admin
    .from("import_jobs")
    .select("original_image_bucket, original_image_path")
    .eq("id", jobId)
    .eq("user_id", userId)
    .single();
  if (jobError) throw jobError;

  return { waiting: claimed, job };
}
