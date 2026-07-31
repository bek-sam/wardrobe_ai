import type { VisualizationRequestResult, VisualizationStatus } from "@/lib/visualization";

type RawOutcome = {
  outcome: string;
  visualization_id?: string;
  status?: string;
  reset_at?: string | null;
  reason?: string;
  consent_version?: string | null;
};

/**
 * The RPC speaks snake_case, the client contract speaks camelCase. Translating
 * once, here, is what keeps `visualizationId` from silently arriving as
 * `undefined` in the browser while the request itself looked successful.
 */
export function normalizeRequestOutcome(raw: unknown): VisualizationRequestResult {
  const value = (raw ?? {}) as RawOutcome;
  const visualizationId = value.visualization_id ?? "";
  const status = (value.status ?? "queued") as VisualizationStatus;

  switch (value.outcome) {
    case "created":
      return { outcome: "created", visualizationId, status: "queued" };
    case "reused":
      return { outcome: "reused", visualizationId, status };
    case "already_fresh":
      return { outcome: "already_fresh", visualizationId, status: "ready" };
    case "queue_full":
      return { outcome: "queue_full", resetAt: value.reset_at ?? null };
    case "quota_exhausted":
      return { outcome: "quota_exhausted", resetAt: value.reset_at ?? null };
    case "needs_identity":
      return { outcome: "needs_identity" };
    case "needs_consent":
      return { outcome: "needs_consent", consentVersion: value.consent_version ?? "" };
    default:
      return { outcome: "conflict", reason: value.reason ?? "This look could not be rendered." };
  }
}
