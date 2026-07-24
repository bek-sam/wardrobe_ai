import type { SupabaseClient } from "@supabase/supabase-js";

import { extractCandidate } from "./extract-candidate";
import { isJobCancelled } from "./job-status";
import { safeFailure } from "./safe-failure";
import type { ImportCandidateRow, ImportJobRow } from "./types";

export async function extractPendingCandidates(admin: SupabaseClient, job: ImportJobRow) {
  if (await isJobCancelled(admin, job)) return;

  const { data, error } = await admin
    .from("import_job_candidates")
    .select("*")
    .eq("job_id", job.id)
    .eq("user_id", job.user_id)
    .eq("status", "extracting");
  if (error) throw error;

  for (const candidate of (data ?? []) as ImportCandidateRow[]) {
    try {
      await extractCandidate(candidate);
    } catch (error) {
      const failure = safeFailure(error);
      await admin
        .from("import_job_candidates")
        .update({ status: "failed", error_code: failure.code, error_message: failure.message })
        .eq("id", candidate.id)
        .eq("user_id", candidate.user_id);
    }
  }
}
