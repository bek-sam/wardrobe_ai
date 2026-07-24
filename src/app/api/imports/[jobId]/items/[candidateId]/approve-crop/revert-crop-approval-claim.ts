import type { SupabaseClient } from "@supabase/supabase-js";

// Unwinds claimCropApproval()'s transition when something after the claim
// fails (missing crop, quota exceeded, regeneration error), so the candidate
// isn't stranded in "extracting" with no crop_asset_metadata and the user can
// retry. Guarded on status='extracting' so it only ever reverts the claim it
// itself made.
export async function revertCropApprovalClaim(
  admin: SupabaseClient,
  userId: string,
  jobId: string,
  candidateId: string,
) {
  await admin
    .from("import_job_candidates")
    .update({ status: "review_crop", crop_approved_at: null })
    .eq("id", candidateId)
    .eq("job_id", jobId)
    .eq("user_id", userId)
    .eq("status", "extracting");
}
