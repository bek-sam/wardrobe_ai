import type { SupabaseClient } from "@supabase/supabase-js";

export async function advanceJobIfAllReviewed(
  admin: SupabaseClient,
  userId: string,
  jobId: string,
) {
  const { data: candidates, error } = await admin
    .from("import_job_candidates")
    .select("status")
    .eq("job_id", jobId)
    .eq("user_id", userId);
  if (error) throw error;

  const statuses = (candidates ?? []).map((candidate) => candidate.status as string);
  const allReviewed =
    statuses.length > 0 &&
    statuses.every((status) => ["review_metadata", "approved", "rejected"].includes(status));
  if (!allReviewed) return;

  await admin
    .from("import_jobs")
    .update({ status: "review_metadata", progress: 70 })
    .eq("id", jobId)
    .eq("user_id", userId)
    .not("status", "in", "(complete,cancelled)");
}
