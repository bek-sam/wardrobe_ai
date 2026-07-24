import type { SupabaseClient } from "@supabase/supabase-js";

import { ApiError } from "@/lib/api/response";

export async function loadWaitingCandidate(
  admin: SupabaseClient,
  userId: string,
  jobId: string,
  candidateId: string,
) {
  const { data: waiting, error: waitingError } = await admin
    .from("import_job_candidates")
    .select("id, bounding_box, crop_storage_path")
    .eq("id", candidateId)
    .eq("job_id", jobId)
    .eq("user_id", userId)
    .eq("status", "review_crop")
    .maybeSingle();
  if (waitingError) throw waitingError;
  if (!waiting)
    throw new ApiError(409, "invalid_candidate_state", "The crop is not awaiting approval.");
  if (!waiting.crop_storage_path)
    throw new ApiError(409, "invalid_candidate_state", "The crop is missing.");

  const { data: job, error: jobError } = await admin
    .from("import_jobs")
    .select("original_image_bucket, original_image_path")
    .eq("id", jobId)
    .eq("user_id", userId)
    .single();
  if (jobError) throw jobError;

  return { waiting, job };
}
