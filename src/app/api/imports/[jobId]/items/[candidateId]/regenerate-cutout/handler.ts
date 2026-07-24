import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";

import type { regenerateCutoutSchema } from "@/features/intake/schemas/import-job";
import { getServerEnvironment } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enforceAiUsageLimits } from "@/lib/usage/limits";

import { claimRegeneration } from "./claim-regeneration";
import { revertRegenerationClaim } from "./revert-regeneration-claim";

type RegenerateCutoutInput = z.infer<typeof regenerateCutoutSchema>;

export async function handleRegenerateCutout(
  supabase: SupabaseClient,
  userId: string,
  jobId: string,
  candidateId: string,
  input: RegenerateCutoutInput,
) {
  const admin = createAdminClient();
  const claimed = await claimRegeneration(admin, userId, jobId, candidateId, input);

  try {
    const environment = getServerEnvironment();
    await enforceAiUsageLimits(supabase, {
      feature: "image_generation",
      dailyLimit: environment.DAILY_IMAGE_LIMIT,
      rollingBucket: "image_generation",
      rollingLimit: environment.IMAGE_RATE_LIMIT_PER_MINUTE,
    });
  } catch (quotaError) {
    await revertRegenerationClaim(admin, userId, jobId, candidateId);
    throw quotaError;
  }

  return claimed;
}
