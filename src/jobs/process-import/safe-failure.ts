export function safeFailure(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown processing error";
  if (/too large|dimensions|format|empty|small|animated/i.test(message)) {
    return { code: "invalid_image", message };
  }
  if (/rate|quota/i.test(message)) {
    return { code: "provider_rate_limited", message: "AI processing is temporarily busy." };
  }
  return { code: "processing_failed", message: "The image could not be processed." };
}
