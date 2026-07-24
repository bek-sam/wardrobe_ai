import type { SupabaseClient } from "@supabase/supabase-js";

import { ApiError } from "@/lib/api/response";

export async function handleCancelImportJob(admin: SupabaseClient, userId: string, jobId: string) {
  const { data, error } = await admin
    .from("import_jobs")
    .update({ status: "cancelled", completed_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("user_id", userId)
    .not("status", "in", "(complete,cancelled)")
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data)
    throw new ApiError(409, "job_not_cancellable", "The import can no longer be cancelled.");
}
