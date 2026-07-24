// Mirrors retryAt() in process-storage-deletions.ts: capped exponential
// backoff so a transiently-failing job (provider hiccup, DB contention)
// doesn't get re-claimed and retried in a tight loop.
export function retryAt(attemptCount: number) {
  const delaySeconds = Math.min(60 * 60, 30 * 2 ** Math.max(0, attemptCount - 1));
  return new Date(Date.now() + delaySeconds * 1_000).toISOString();
}
