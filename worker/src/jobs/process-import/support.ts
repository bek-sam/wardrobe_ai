import { getServerEnvironment } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildAnalysisCandidates } from "./build-analysis-candidates";
import { downloadAndNormalizeOriginal } from "./download-and-normalize-original";
import { markJobAnalyzing } from "./mark-job-analyzing";
import { persistAnalysisResults } from "./persist-analysis-results";
import type { SupabaseClient } from "@supabase/supabase-js";
import { excludeTerminalJobStatuses } from "./job-status";
import type { ImportJobRow } from "./primitives";

export type { ImportCandidateRow, ImportJobRow } from "./primitives";

export async function analyzeJob(job: ImportJobRow) {
  const admin = createAdminClient();
  const environment = getServerEnvironment();
  const claimed = await markJobAnalyzing(admin, job);
  if (!claimed) return null;

  const normalized = await downloadAndNormalizeOriginal(admin, job);
  const { catalog, candidates } = await buildAnalysisCandidates(
    admin,
    environment,
    job,
    normalized,
  );
  return persistAnalysisResults(admin, environment, job, normalized, catalog, candidates);
}

/**
 * Classifies a processing error into the safe code/message pair stored on the
 * job row. The generic fallback is deliberate -- a provider or decoder message
 * must not reach the user -- but the original was previously discarded, so an
 * import that failed for an unrecognized reason left no trace anywhere and was
 * undiagnosable from either the UI or the database. The full message goes to
 * the server log only; the row still carries the generic text.
 */
export function safeFailure(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown processing error";
  if (/too large|dimensions|format|empty|small|animated/i.test(message)) {
    return { code: "invalid_image", message };
  }
  if (/rate|quota/i.test(message)) {
    return { code: "provider_rate_limited", message: "AI processing is temporarily busy." };
  }
  console.error("import_processing_failed", { message });
  return { code: "processing_failed", message: "The image could not be processed." };
}

export async function failJob(job: ImportJobRow, error: unknown) {
  const failure = safeFailure(error);
  const admin = createAdminClient();
  const query = admin
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
    .eq("user_id", job.user_id);
  await excludeTerminalJobStatuses(query);
}

export async function resolveNextJobStatus(admin: SupabaseClient, job: ImportJobRow) {
  const { data: remaining } = await admin
    .from("import_job_candidates")
    .select("status")
    .eq("job_id", job.id)
    .eq("user_id", job.user_id);
  const statuses = (remaining ?? []).map((candidate) => candidate.status as string);
  const nextStatus = statuses.some((status) => status === "extracting")
    ? "extracting"
    : statuses.some((status) => status === "review_crop" || status === "regenerating_crop")
      ? "review_crop"
      : "review_metadata";
  const query = admin
    .from("import_jobs")
    .update({
      status: nextStatus,
      progress: nextStatus === "review_metadata" ? 70 : 50,
      locked_at: null,
      locked_until: null,
      next_attempt_at: null,
    })
    .eq("id", job.id)
    .eq("user_id", job.user_id);
  const { data } = await excludeTerminalJobStatuses(query).select("id").maybeSingle();
  if (data) return nextStatus;

  const { data: current } = await admin
    .from("import_jobs")
    .select("status")
    .eq("id", job.id)
    .eq("user_id", job.user_id)
    .maybeSingle();
  return current?.status ?? "cancelled";
}
