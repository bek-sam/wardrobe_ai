import { requestJson } from "@/lib/api/request";

import type { StudioVisualization } from "../types";

export type VisualizationOutcome = {
  outcome:
    | "created"
    | "reused"
    | "already_fresh"
    | "queue_full"
    | "quota_exhausted"
    | "conflict"
    | "needs_identity"
    | "needs_consent";
  visualizationId?: string;
  status?: string;
  consentVersion?: string;
  resetAt?: string | null;
  reason?: string;
  pollAfterMs: number;
};

export type SnapshotSelection = { item_id: string; role: string; sort_order: number };

export function createVisualization(items: readonly SnapshotSelection[]) {
  return requestJson<VisualizationOutcome>("/api/outfit-visualizations", {
    method: "POST",
    body: JSON.stringify({ sourceKind: "composition", items }),
  });
}

export function fetchVisualization(visualizationId: string, signal?: AbortSignal) {
  return requestJson<StudioVisualization>(`/api/outfit-visualizations/${visualizationId}`, {
    signal,
  });
}

export function regenerateVisualization(visualizationId: string) {
  return requestJson<VisualizationOutcome>(
    `/api/outfit-visualizations/${visualizationId}/regenerate`,
    { method: "POST" },
  );
}

/** No-op unless the deployment enables inline processing; used in dev and E2E. */
export function processVisualizationInline(visualizationId: string) {
  return requestJson<unknown>(`/api/outfit-visualizations/${visualizationId}/process`, {
    method: "POST",
  }).catch(() => null);
}

export function submitFeedback(visualizationId: string, reason: string, comment: string | null) {
  return requestJson<unknown>(`/api/outfit-visualizations/${visualizationId}/feedback`, {
    method: "POST",
    body: JSON.stringify({ reason, comment }),
  });
}
