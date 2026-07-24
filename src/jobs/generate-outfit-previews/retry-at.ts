// Mirrors retryAt() in process-storage-deletions.ts / compile-wardrobe.ts.
export function retryAt(attemptCount: number) {
  const delaySeconds = Math.min(60 * 60, 30 * 2 ** Math.max(0, attemptCount - 1));
  return new Date(Date.now() + delaySeconds * 1_000).toISOString();
}
