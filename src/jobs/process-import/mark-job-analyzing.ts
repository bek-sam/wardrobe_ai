import type { SupabaseClient } from "@supabase/supabase-js";

import type { ImportJobRow } from "./types";

export async function markJobAnalyzing(admin: SupabaseClient, job: ImportJobRow) {
  await admin
    .from("import_jobs")
    .update({
      status: "analyzing",
      progress: 10,
      attempt_count: job.status === "analyzing" ? job.attempt_count : job.attempt_count + 1,
      processing_started_at: new Date().toISOString(),
      error_code: null,
      error_message: null,
    })
    .eq("id", job.id)
    .eq("user_id", job.user_id)
    .in("status", ["queued", "failed", "analyzing"]);
}
