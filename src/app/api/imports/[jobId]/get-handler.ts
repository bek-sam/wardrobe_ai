import type { SupabaseClient } from "@supabase/supabase-js";

import { withSignedImportUrls } from "@/features/intake/server/job-view";
import { ApiError } from "@/lib/api/response";

export async function handleGetImportJob(supabase: SupabaseClient, userId: string, jobId: string) {
  const { data, error } = await supabase
    .from("import_jobs")
    .select("*, import_job_candidates(*)")
    .eq("id", jobId)
    .eq("user_id", userId)
    .order("ordinal", { referencedTable: "import_job_candidates", ascending: true })
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError(404, "job_not_found", "Import job not found.");
  return withSignedImportUrls(supabase, data);
}
