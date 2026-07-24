import type { SupabaseClient } from "@supabase/supabase-js";

// Unwinds claimCropApproval()'s transition when something after the claim
// fails (missing crop, quota exceeded, regeneration error), so the candidate
// isn't stranded in "regenerating_crop" with no crop_asset_metadata and the
// user can retry. Guarded on status='regenerating_crop' so it only ever
// reverts the claim it itself made -- calling it after a more specific
// revert (e.g. the quota-failure path below) already ran is a safe no-op.
export async function revertCropApprovalClaim(
  admin: SupabaseClient,
  userId: string,
  jobId: string,
  candidateId: string,
  failure?: { status: "failed"; errorCode: string; errorMessage: string },
) {
  await admin
    .from("import_job_candidates")
    .update(
      failure
        ? {
            status: failure.status,
            error_code: failure.errorCode,
            error_message: failure.errorMessage,
            crop_approved_at: null,
          }
        : { status: "review_crop", crop_approved_at: null },
    )
    .eq("id", candidateId)
    .eq("job_id", jobId)
    .eq("user_id", userId)
    .eq("status", "regenerating_crop");
}
