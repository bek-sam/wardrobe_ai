import type { ZodType } from "zod";
import { NextResponse } from "next/server";
import { AuthenticationError } from "@/lib/auth/auth-error";

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

export async function parseJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    throw new ApiError(400, "invalid_json", "The request body must be valid JSON.");
  }

  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new ApiError(
      422,
      "validation_failed",
      "The request data is invalid.",
      parsed.error.flatten(),
    );
  }
  return parsed.data;
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<ApiSuccess<T>>({ data }, init);
}

export function routeError(error: unknown) {
  // Checked before ApiError, which it extends, so the Retry-After hint is not
  // lost to the more general branch.
  if (error instanceof RateLimitError) {
    return NextResponse.json<ApiFailure>(
      { error: { code: error.code, message: error.message } },
      { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } },
    );
  }
  if (error instanceof AuthenticationError) {
    return NextResponse.json<ApiFailure>(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }
  if (error instanceof ApiError) {
    return NextResponse.json<ApiFailure>(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status },
    );
  }

  console.error("Unhandled route error", {
    name: error instanceof Error ? error.name : "UnknownError",
    code:
      error && typeof error === "object" && "code" in error && typeof error.code === "string"
        ? error.code
        : "unclassified",
  });
  return NextResponse.json<ApiFailure>(
    { error: { code: "internal_error", message: "The request could not be completed." } },
    { status: 500 },
  );
}
