import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";

import type { regenerateCutoutSchema } from "@/features/intake/schemas/import-job";
import { ApiError } from "@/lib/api/response";
import { getServerEnvironment } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enforceAiUsageLimits } from "@/lib/usage/limits";

import { validateRegeneratableCandidate } from "./validate-candidate";

type RegenerateCutoutInput = z.infer<typeof regenerateCutoutSchema>;

export async function handleRegenerateCutout(
  supabase: SupabaseClient,
  userId: string,
  jobId: string,
  candidateId: string,
  input: RegenerateCutoutInput,
) {
  const admin = createAdminClient();
  await validateRegeneratableCandidate(admin, userId, jobId, candidateId);

  const environment = getServerEnvironment();
  await enforceAiUsageLimits(supabase, {
    feature: "image_generation",
    dailyLimit: environment.DAILY_IMAGE_LIMIT,
    rollingBucket: "image_generation",
    rollingLimit: environment.IMAGE_RATE_LIMIT_PER_MINUTE,
  });

  const { data, error } = await admin
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
    .in("status", ["review_cutout", "review_metadata", "failed"])
    .not("crop_storage_path", "is", null)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new ApiError(409, "invalid_candidate_state", "This candidate cannot be regenerated yet.");
  }
  return data;
}
