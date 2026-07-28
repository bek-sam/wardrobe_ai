export type ApiSuccess<T> = { data: T };
export type ApiFailure = { error: { code: string; message: string; details?: unknown } };

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * A throttled request. The message and code are identical for every caller and
 * every bucket: revealing *which* limit was hit, or how much budget is left,
 * would tell an attacker whether an address is registered and let them pace
 * requests to stay just under the threshold.
 */
export class RateLimitError extends ApiError {
  constructor(readonly retryAfterSeconds: number) {
    super(429, "rate_limited", "Too many attempts. Wait a few minutes and try again.");
    this.name = "RateLimitError";
  }
}
