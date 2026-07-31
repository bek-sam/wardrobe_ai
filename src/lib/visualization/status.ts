import type { VisualizationStatus } from "./types";

/**
 * Named progress steps, not a fake percentage: the backend genuinely moves
 * through these stages, so each label is truthful about where the work is.
 */
const PROGRESS_LABELS: Partial<Record<VisualizationStatus, string>> = {
  queued: "Waiting to start",
  validating_inputs: "Preparing your exact pieces",
  generating: "Creating the try-on",
  qa_review: "Checking garment and identity fidelity",
  localizing: "Mapping interactive garment details",
};

const TERMINAL: ReadonlySet<VisualizationStatus> = new Set<VisualizationStatus>([
  "ready",
  "stale",
  "failed_retryable",
  "failed_terminal",
  "blocked",
  "superseded",
  "needs_identity",
  "needs_consent",
]);

export function visualizationProgressLabel(status: VisualizationStatus): string | null {
  return PROGRESS_LABELS[status] ?? null;
}

/** True while the pipeline is still working and the client should keep polling. */
export function isVisualizationInFlight(status: VisualizationStatus): boolean {
  return !TERMINAL.has(status);
}

export function isVisualizationRetryable(status: VisualizationStatus): boolean {
  return status === "failed_retryable" || status === "stale" || status === "superseded";
}

/** Only a ready or stale visualization has bytes worth signing a URL for. */
export function hasVisualizationImage(status: VisualizationStatus): boolean {
  return status === "ready" || status === "stale";
}
