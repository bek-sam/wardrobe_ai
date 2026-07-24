import type { SupabaseClient } from "@supabase/supabase-js";

import { getServerEnvironment } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enforceAiUsageLimits } from "@/lib/usage/limits";

import { advanceCandidateStatus } from "./advance-candidate-status";
import { loadWaitingCandidate } from "./load-waiting-candidate";
import { regenerateCrop } from "./regenerate-crop";

export async function handleApproveCrop(
  supabase: SupabaseClient,
  userId: string,
  jobId: string,
  candidateId: string,
) {
  const admin = createAdminClient();
  const { waiting, job } = await loadWaitingCandidate(admin, userId, jobId, candidateId);

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

  return advanceCandidateStatus(admin, userId, jobId, candidateId, cropAssetMetadata);
}
