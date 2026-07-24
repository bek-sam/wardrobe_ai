import type { AdminClient, WardrobeCompilationJobRow } from "./types";

export async function loadJob(
  admin: AdminClient,
  jobId: string,
): Promise<WardrobeCompilationJobRow> {
  const { data, error } = await admin
    .from("wardrobe_compilation_jobs")
    .select("id, user_id, status, attempt_count")
    .eq("id", jobId)
    .single();
  if (error || !data) throw error ?? new Error("Wardrobe compilation job not found.");
  return data as WardrobeCompilationJobRow;
}
