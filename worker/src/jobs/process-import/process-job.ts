import { createAdminClient } from "@/lib/supabase/admin";

import { analyzeJob } from "./support";
import { failJob } from "./support";
import { resolveNextJobStatus } from "./support";
import type { SupabaseClient } from "@supabase/supabase-js";
import { extractCandidate } from "./extract-candidate";
import { isJobCancelled } from "./job-status";
import { safeFailure } from "./support";
import type { ImportCandidateRow, ImportJobRow } from "./primitives";

async function loadJob(jobId: string, expectedUserId?: string): Promise<ImportJobRow> {
  const admin = createAdminClient();
  let query = admin.from("import_jobs").select("*").eq("id", jobId);
  if (expectedUserId) query = query.eq("user_id", expectedUserId);
  const { data, error } = await query.single();
  if (error || !data) throw error ?? new Error("Import job not found.");
  return data as ImportJobRow;
}

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

export async function processImportJob(jobId: string, expectedUserId?: string) {
  const job = await loadJob(jobId, expectedUserId);
  try {
    if (["queued", "failed", "analyzing"].includes(job.status)) {
      const candidateCount = await analyzeJob(job);
      if (candidateCount === null) return { jobId: job.id, status: "cancelled" };
      if (candidateCount === 0) return { jobId: job.id, status: "failed" };
    }

    const admin = createAdminClient();
    await extractPendingCandidates(admin, job);
    const nextStatus = await resolveNextJobStatus(admin, job);
    return { jobId: job.id, status: nextStatus };
  } catch (error) {
    await failJob(job, error);
    throw error;
  }
}
