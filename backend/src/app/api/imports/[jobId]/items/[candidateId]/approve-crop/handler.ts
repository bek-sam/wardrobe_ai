import type { SupabaseClient } from "@supabase/supabase-js";

import { getServerEnvironment } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enforceAiUsageLimits } from "@/lib/usage/limits";
import { regenerateCrop } from "./regenerate-crop";
import { ApiError } from "@/lib/api/response";

// Unwinds claimCropApproval()'s transition when something after the claim
// fails (missing crop, quota exceeded, regeneration error), so the candidate
// isn't stranded in "regenerating_crop" with no crop_asset_metadata and the
// user can retry. Guarded on status='regenerating_crop' so it only ever
// reverts the claim it itself made -- calling it after a more specific
// revert (e.g. the quota-failure path below) already ran is a safe no-op.
async function revertCropApprovalClaim(
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

// Atomically claims the review_crop -> regenerating_crop transition before
// any quota is spent or real regeneration work happens, so two simultaneous
// approve-crop requests can't both consume quota/do the image work and have
// only one win at the end -- the loser gets 409 immediately here, quota
// untouched. regenerating_crop (rather than extracting) keeps the candidate
// invisible to the background worker's extracting-only query until
// finalizeCropApproval() has actually uploaded the regenerated crop.
async function claimCropApproval(
  admin: SupabaseClient,
  userId: string,
  jobId: string,
  candidateId: string,
) {
  const { data: claimed, error } = await admin
    .from("import_job_candidates")
    .update({ status: "regenerating_crop", crop_approved_at: new Date().toISOString() })
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

// The candidate was claimed into regenerating_crop by claimCropApproval();
// this is the sole place it becomes worker-visible again, transitioning to
// extracting only now that the regenerated crop has actually been uploaded,
// so the background worker never extracts from a stale crop.
async function finalizeCropApproval(
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

export async function handleApproveCrop(
  supabase: SupabaseClient,
  userId: string,
  jobId: string,
  candidateId: string,
) {
  const admin = createAdminClient();

  try {
    const { waiting, job } = await claimCropApproval(admin, userId, jobId, candidateId);
    const environment = getServerEnvironment();

    try {
      await enforceAiUsageLimits(supabase, {
        feature: "image_generation",
        dailyLimit: environment.DAILY_IMAGE_LIMIT,
        rollingBucket: "image_generation",
        rollingLimit: environment.IMAGE_RATE_LIMIT_PER_MINUTE,
      });
    } catch (quotaError) {
      await revertCropApprovalClaim(admin, userId, jobId, candidateId, {
        status: "failed",
        errorCode: "quota_exceeded",
        errorMessage: "Daily image generation limit reached.",
      });
      throw quotaError;
    }

    const cropAssetMetadata = await regenerateCrop(
      admin,
      environment,
      userId,
      job,
      waiting.bounding_box,
      waiting.crop_storage_path,
    );

    return await finalizeCropApproval(admin, userId, jobId, candidateId, cropAssetMetadata);
  } catch (error) {
    await revertCropApprovalClaim(admin, userId, jobId, candidateId);
    throw error;
  }
}
