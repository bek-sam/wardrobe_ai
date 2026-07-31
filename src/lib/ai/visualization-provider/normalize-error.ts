import { ERROR_MESSAGE_SIGNATURES, ERROR_STATUS_SIGNATURES } from "./error-signatures.data";
import { VisualizationProviderError } from "./provider-error";

function safeRequestId(error: unknown): string | null {
  const requestId = (error as { requestID?: unknown })?.requestID;
  return typeof requestId === "string" ? requestId : null;
}

function statusOf(error: unknown): number | null {
  const status = (error as { status?: unknown })?.status;
  return typeof status === "number" ? status : null;
}

/**
 * Reduces any thrown provider value to a bounded code plus a safe, user-facing
 * summary. Never re-throws the original: SDK errors can carry the full request
 * body, which here means the prompt and the user's private reference photo.
 */
export function normalizeVisualizationProviderError(error: unknown): VisualizationProviderError {
  if (error instanceof VisualizationProviderError) return error;

  const requestId = safeRequestId(error);
  const status = statusOf(error);
  const byStatus = ERROR_STATUS_SIGNATURES.find(([code]) => code === status);
  if (byStatus) return new VisualizationProviderError(byStatus[1], byStatus[2], requestId);

  const message = error instanceof Error ? error.message : String(error);
  const byMessage = ERROR_MESSAGE_SIGNATURES.find(([pattern]) => pattern.test(message));
  if (byMessage) return new VisualizationProviderError(byMessage[1], byMessage[2], requestId);

  if (status !== null && status >= 500) {
    return new VisualizationProviderError(
      "provider_transient",
      "The image provider is temporarily unavailable.",
      requestId,
    );
  }
  return new VisualizationProviderError(
    "unknown",
    "The try-on could not be generated right now.",
    requestId,
  );
}
