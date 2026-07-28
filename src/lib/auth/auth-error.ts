import {
  AUTH_ERROR_MESSAGES,
  SUPABASE_ERROR_CODE_MAP,
  type AuthFailureCode,
} from "./auth-messages.data";

export type AuthFailure = { code: AuthFailureCode; message: string };

export function authFailure(code: AuthFailureCode): AuthFailure {
  return { code, message: AUTH_ERROR_MESSAGES[code] };
}

function readErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

function readErrorStatus(error: unknown): number | null {
  if (typeof error !== "object" || error === null) return null;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : null;
}

/**
 * Translates a provider error into one of our own messages. The provider's
 * own `message` is never surfaced: unmapped codes fall through to a generic
 * failure so a new upstream string cannot start leaking internals — or
 * account existence — into the UI on its own.
 *
 * `fallback` lets a caller pick the shape of "unknown failure" that keeps its
 * own flow enumeration-safe (login prefers `invalid_credentials`).
 */
export function mapAuthError(
  error: unknown,
  fallback: AuthFailureCode = "unavailable",
): AuthFailure {
  const code = readErrorCode(error);
  const mapped = code ? SUPABASE_ERROR_CODE_MAP[code] : undefined;
  if (mapped) return authFailure(mapped);
  // Some gateway-level throttling arrives as a bare 429 with no code.
  if (readErrorStatus(error) === 429) return authFailure("rate_limited");
  return authFailure(fallback);
}
