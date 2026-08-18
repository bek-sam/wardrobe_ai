import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";

import type { regenerateCutoutSchema } from "@/features/intake/schemas/import-job";
import { getServerEnvironment } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enforceAiUsageLimits } from "@/lib/usage/limits";
import { ApiError } from "@/lib/api/response";

type RegenerationClaimInput = z.infer<typeof regenerateCutoutSchema>;

const CLAIMABLE_STATUSES = ["review_cutout", "review_metadata", "failed"];

// Atomic claim first: a losing concurrent request gets 409 here, before any
// quota is spent, instead of both requests consuming quota and only one
// winning this transition.
async function claimRegeneration(
  admin: SupabaseClient,
  userId: string,
  jobId: string,
  candidateId: string,
  input: RegenerationClaimInput,
) {
  const { data: claimed, error } = await admin
    .from("import_job_candidates")
    .update({
      status: "extracting",
      regeneration_prompt: input.instruction ?? null,
      cleanup_tolerance: input.cleanupTolerance ?? 46,
      error_code: null,
      error_message: null,
    })
    .eq("id", candidateId)
    .eq("job_id", jobId)
    .eq("user_id", userId)
    .in("status", CLAIMABLE_STATUSES)
    .not("crop_storage_path", "is", null)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!claimed) {
    throw new ApiError(409, "invalid_candidate_state", "This candidate cannot be regenerated yet.");
  }
  return claimed;
}

// Unwinds the atomic claim in handler.ts when quota enforcement fails after
// it, landing the candidate in a valid, retryable state instead of stranding
// it in "extracting" with no generation ever happening.
async function revertRegenerationClaim(
  admin: SupabaseClient,
  userId: string,
  jobId: string,
  candidateId: string,
) {
  await admin
    .from("import_job_candidates")
    .update({
      status: "failed",
      error_code: "quota_exceeded",
      error_message: "Daily image generation limit reached.",
    })
    .eq("id", candidateId)
    .eq("job_id", jobId)
    .eq("user_id", userId)
    .eq("status", "extracting");
}

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
