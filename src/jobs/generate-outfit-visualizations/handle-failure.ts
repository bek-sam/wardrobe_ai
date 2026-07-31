import { normalizeVisualizationProviderError } from "@/lib/ai/visualization-provider";

import type { AdminClient, VisualizationJobRow } from "./types";

/** Bounded exponential backoff, mirroring the other durable workers. */
export function retryAt(attemptCount: number) {
  const delaySeconds = Math.min(30 * 60, 30 * 2 ** Math.max(0, attemptCount - 1));
  return new Date(Date.now() + delaySeconds * 1_000).toISOString();
}

/**
 * Records a failure with a bounded code and a safe summary. Nothing here logs
 * the prompt, the image bytes, a signed URL, or a storage path — a provider
 * error object can echo the whole request body, which is exactly the private
 * data that must not reach a log line.
 */
export async function handleVisualizationFailure(
  admin: AdminClient,
  job: VisualizationJobRow,
  error: unknown,
) {
  const normalized = normalizeVisualizationProviderError(error);
  const retryable = normalized.retryable && job.attempt_count < job.max_attempts;

  console.error("Outfit visualization failed", {
    jobId: job.id,
    visualizationId: job.visualization_id,
    errorCode: normalized.code,
    attempt: job.attempt_count,
    retryable,
    requestId: normalized.requestId,
  });

  try {
    await admin.rpc("fail_outfit_visualization", {
      p_job_id: job.id,
      p_user_id: job.user_id,
      p_error_code: normalized.code,
      p_error_summary: normalized.safeSummary,
      p_retryable: retryable,
      p_next_attempt_at: retryable ? retryAt(job.attempt_count) : null,
      p_qa_summary: null,
      p_request_id: normalized.requestId,
    });
  } catch {
    // Best-effort bookkeeping; the lease expiring is the backstop.
  }
}
