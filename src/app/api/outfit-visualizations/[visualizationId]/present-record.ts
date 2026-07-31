import {
  AI_TRYON_DISCLAIMER,
  isVisualizationInFlight,
  isVisualizationRetryable,
  visualizationProgressLabel,
} from "@/lib/visualization";

import type { VisualizationRecord } from "./types";

/**
 * The safe, user-facing view of a visualization row. Deliberately omits the
 * bucket, storage path, source hash, provider request body, and model key:
 * the client gets a short-lived signed URL and a status, never a durable
 * pointer at private bytes.
 */
export function presentVisualizationRecord(record: VisualizationRecord) {
  return {
    id: record.id,
    status: record.status,
    sourceKind: record.source_kind,
    sourceId: record.source_id,
    progressLabel: visualizationProgressLabel(record.status),
    inFlight: isVisualizationInFlight(record.status),
    canRetry: isVisualizationRetryable(record.status) || record.status === "failed_retryable",
    canChangePhoto: record.error_code === "qa_rejected" || record.status === "blocked",
    staleReason: record.stale_reason,
    errorCode: record.error_code,
    errorSummary: record.error_summary,
    qaStatus: record.qa_status,
    attemptCount: record.attempt_count,
    correctiveAttemptCount: record.corrective_attempt_count,
    disclaimer: AI_TRYON_DISCLAIMER,
    createdAt: record.created_at,
    completedAt: record.completed_at,
  };
}
