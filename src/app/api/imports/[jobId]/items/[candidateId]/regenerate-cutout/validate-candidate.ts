import type { SupabaseClient } from "@supabase/supabase-js";

import { ApiError } from "@/lib/api/response";

export async function validateRegeneratableCandidate(
  admin: SupabaseClient,
  userId: string,
  jobId: string,
  candidateId: string,
) {
  const { data: waiting, error } = await admin
    .from("import_job_candidates")
    .select("id")
    .eq("id", candidateId)
    .eq("job_id", jobId)
    .eq("user_id", userId)
    .in("status", ["review_cutout", "review_metadata", "failed"])
    .not("crop_storage_path", "is", null)
    .maybeSingle();
  if (error) throw error;
  if (!waiting) {
    throw new ApiError(409, "invalid_candidate_state", "This candidate cannot be regenerated yet.");
  }
}
