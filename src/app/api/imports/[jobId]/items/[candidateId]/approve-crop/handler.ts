import type { SupabaseClient } from "@supabase/supabase-js";

import { getServerEnvironment } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enforceAiUsageLimits } from "@/lib/usage/limits";

import { claimCropApproval } from "./claim-crop-approval";
import { finalizeCropApproval } from "./finalize-crop-approval";
import { regenerateCrop } from "./regenerate-crop";
import { revertCropApprovalClaim } from "./revert-crop-approval-claim";

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
