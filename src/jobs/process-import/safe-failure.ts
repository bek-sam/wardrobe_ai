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
