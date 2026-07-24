import { createAdminClient } from "@/lib/supabase/admin";

import { safeFailure } from "./safe-failure";
import type { ImportJobRow } from "./types";

export async function failJob(job: ImportJobRow, error: unknown) {
  const failure = safeFailure(error);
  const admin = createAdminClient();
  await admin
    .from("import_jobs")
    .update({
      status: "failed",
      error_code: failure.code,
      error_message: failure.message,
      locked_at: null,
      locked_until: null,
      next_attempt_at: new Date(Date.now() + 30_000).toISOString(),
    })
    .eq("id", job.id)
    .eq("user_id", job.user_id)
    .not("status", "in", "(complete,cancelled)");
}
