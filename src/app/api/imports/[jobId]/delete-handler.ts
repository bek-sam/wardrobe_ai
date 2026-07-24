import type { SupabaseClient } from "@supabase/supabase-js";

import { excludeTerminalJobStatuses } from "@/jobs/process-import/job-status";
import { ApiError } from "@/lib/api/response";

export async function handleCancelImportJob(admin: SupabaseClient, userId: string, jobId: string) {
  const query = admin
    .from("import_jobs")
    .update({ status: "cancelled", completed_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("user_id", userId);
  const { data, error } = await excludeTerminalJobStatuses(query).select("id").maybeSingle();
  if (error) throw error;
  if (!data)
    throw new ApiError(409, "job_not_cancellable", "The import can no longer be cancelled.");
}
