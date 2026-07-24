import type { SupabaseClient } from "@supabase/supabase-js";

import { withSignedImportUrls } from "@/features/intake/server/job-view";

export async function handleListImportJobs(
  supabase: SupabaseClient,
  userId: string,
  requestedStatus: string | null,
) {
  let query = supabase
    .from("import_jobs")
    .select("*, import_job_candidates(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (requestedStatus) query = query.eq("status", requestedStatus);
  const { data, error } = await query;
  if (error) throw error;
  return Promise.all((data ?? []).map((job) => withSignedImportUrls(supabase, job)));
}
