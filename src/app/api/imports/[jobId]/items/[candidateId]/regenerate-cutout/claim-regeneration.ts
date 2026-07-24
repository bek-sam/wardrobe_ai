import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";

import type { regenerateCutoutSchema } from "@/features/intake/schemas/import-job";
import { ApiError } from "@/lib/api/response";

type RegenerateCutoutInput = z.infer<typeof regenerateCutoutSchema>;

const CLAIMABLE_STATUSES = ["review_cutout", "review_metadata", "failed"];

// Atomic claim first: a losing concurrent request gets 409 here, before any
// quota is spent, instead of both requests consuming quota and only one
// winning this transition.
export async function claimRegeneration(
  admin: SupabaseClient,
  userId: string,
  jobId: string,
  candidateId: string,
  input: RegenerateCutoutInput,
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
