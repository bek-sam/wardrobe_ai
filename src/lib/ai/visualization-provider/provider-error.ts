export const VISUALIZATION_ERROR_CODES = [
  "configuration_missing",
  "authentication",
  "unsupported_capability",
  "input_validation",
  "moderation_blocked",
  "rate_limited",
  "provider_transient",
  "timeout",
  "invalid_output",
  "qa_rejected",
  "unknown",
] as const;

export type VisualizationErrorCode = (typeof VISUALIZATION_ERROR_CODES)[number];

/** Codes worth another attempt on a backoff; everything else is terminal. */
const RETRYABLE: ReadonlySet<VisualizationErrorCode> = new Set<VisualizationErrorCode>([
  "rate_limited",
  "provider_transient",
  "timeout",
  "invalid_output",
]);

/**
 * A provider failure reduced to a bounded code and a safe summary. The
 * original error object is deliberately dropped: provider errors can echo
 * request bodies, and those carry the private prompt and image bytes.
 */
export class VisualizationProviderError extends Error {
  constructor(
    readonly code: VisualizationErrorCode,
    readonly safeSummary: string,
    readonly requestId: string | null = null,
  ) {
    super(safeSummary);
    this.name = "VisualizationProviderError";
  }

  get retryable(): boolean {
    return RETRYABLE.has(this.code);
  }
}

export function isRetryableVisualizationError(error: unknown): boolean {
  return error instanceof VisualizationProviderError && error.retryable;
}
