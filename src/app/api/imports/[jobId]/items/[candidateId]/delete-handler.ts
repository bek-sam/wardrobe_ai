import type { SupabaseClient } from "@supabase/supabase-js";

import { ApiError } from "@/lib/api/response";

import { advanceJobIfAllReviewed } from "./advance-job-if-all-reviewed";

export async function handleSkipImportCandidate(
  admin: SupabaseClient,
  userId: string,
  jobId: string,
  candidateId: string,
) {
  const { data, error } = await admin
    .from("import_job_candidates")
    .update({ status: "rejected", error_code: null, error_message: null })
    .eq("id", candidateId)
    .eq("job_id", jobId)
    .eq("user_id", userId)
    .in("status", ["review_crop", "review_cutout", "review_metadata", "failed"])
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new ApiError(409, "candidate_not_rejectable", "This candidate can no longer be skipped.");
  }

  await advanceJobIfAllReviewed(admin, userId, jobId);
  return data;
}
