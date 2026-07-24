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
  const { waiting, job } = await claimCropApproval(admin, userId, jobId, candidateId);

  try {
    const environment = getServerEnvironment();
    await enforceAiUsageLimits(supabase, {
      feature: "image_generation",
      dailyLimit: environment.DAILY_IMAGE_LIMIT,
      rollingBucket: "image_generation",
      rollingLimit: environment.IMAGE_RATE_LIMIT_PER_MINUTE,
    });

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
