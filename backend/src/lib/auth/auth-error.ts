/**
 * Every user-visible authentication message, keyed by a stable internal code.
 *
 * Two rules shape this table:
 *
 *  1. Nothing here may reveal whether an account exists. `invalid_credentials`
 *     and `email_not_confirmed` deliberately share one message — telling a
 *     stranger "that password is wrong for an unconfirmed account" confirms
 *     the address is registered. The login page instead carries a permanent,
 *     enumeration-safe link to resend a confirmation email.
 *  2. Provider wording never reaches the browser. These strings are ours, so a
 *     future Supabase message change cannot leak internals into the UI.
 */
const AUTH_ERROR_MESSAGES = {
  invalid_credentials: "The email or password is incorrect.",
  invalid_request: "Check the form and try again.",
  signup_disabled: "New accounts are invite-only right now.",
  captcha_required: "Complete the verification challenge and try again.",
  captcha_failed: "The verification challenge could not be confirmed. Try again.",
  rate_limited: "Too many attempts. Wait a few minutes and try again.",
  weak_password: "Choose a longer password.",
  same_password: "Choose a password you have not used on this account before.",
  expired_link: "That link is invalid, already used, or expired. Request a new one.",
  reset_session_expired: "Your password reset link expired. Request a new one.",
  reauthentication_failed: "That did not match our records. Try again.",
  reauthentication_required: "Confirm it is you before making this change.",
  mfa_required: "Enter the code from your authenticator app to continue.",
  mfa_invalid_code: "That code did not work. Codes expire quickly — try the next one.",
  mfa_enrollment_failed: "The authenticator could not be added. Start again.",
  mfa_factor_not_found: "That authenticator is no longer on your account.",
  email_change_failed: "That email address could not be used. Try a different one.",
  identity_last_remaining: "Add another sign-in method before removing this one.",
  identity_link_failed: "That account could not be linked. It may already be in use.",
  provider_disabled: "That sign-in method is not available.",
  logout_partial: "You were signed out here, but other sessions may still be active.",
  unavailable: "Something went wrong. Try again in a moment.",
} as const;

type AuthFailureCode = keyof typeof AUTH_ERROR_MESSAGES;

/**
 * Supabase error code → our code. Anything unmapped becomes `unavailable`,
 * which is the fail-safe: a message we wrote, with no provider detail in it.
 */
const SUPABASE_ERROR_CODE_MAP: Record<string, AuthFailureCode> = {
  invalid_credentials: "invalid_credentials",
  email_not_confirmed: "invalid_credentials",
  user_not_found: "invalid_credentials",
  user_banned: "invalid_credentials",
  validation_failed: "invalid_request",
  email_address_invalid: "invalid_request",
  email_address_not_authorized: "invalid_request",
  signup_disabled: "signup_disabled",
  email_provider_disabled: "provider_disabled",
  provider_disabled: "provider_disabled",
  oauth_provider_not_supported: "provider_disabled",
  manual_linking_disabled: "provider_disabled",
  captcha_failed: "captcha_failed",
  over_request_rate_limit: "rate_limited",
  over_email_send_rate_limit: "rate_limited",
  request_timeout: "unavailable",
  weak_password: "weak_password",
  same_password: "same_password",
  otp_expired: "expired_link",
  otp_disabled: "provider_disabled",
  flow_state_expired: "expired_link",
  flow_state_not_found: "expired_link",
  bad_code_verifier: "expired_link",
  bad_oauth_state: "expired_link",
  bad_oauth_callback: "expired_link",
  session_expired: "reset_session_expired",
  session_not_found: "reset_session_expired",
  bad_jwt: "reset_session_expired",
  reauthentication_needed: "reauthentication_required",
  reauth_nonce_missing: "reauthentication_required",
  reauthentication_not_valid: "reauthentication_failed",
  insufficient_aal: "mfa_required",
  mfa_verification_failed: "mfa_invalid_code",
  mfa_verification_rejected: "mfa_invalid_code",
  mfa_challenge_expired: "mfa_invalid_code",
  mfa_ip_address_mismatch: "mfa_invalid_code",
  mfa_factor_not_found: "mfa_factor_not_found",
  too_many_enrolled_mfa_factors: "mfa_enrollment_failed",
  mfa_factor_name_conflict: "mfa_enrollment_failed",
  mfa_verified_factor_exists: "mfa_enrollment_failed",
  mfa_totp_enroll_not_enabled: "provider_disabled",
  mfa_totp_verify_not_enabled: "provider_disabled",
  email_exists: "email_change_failed",
  user_already_exists: "email_change_failed",
  conflict: "email_change_failed",
  single_identity_not_deletable: "identity_last_remaining",
  email_conflict_identity_not_deletable: "identity_last_remaining",
  identity_already_exists: "identity_link_failed",
  identity_not_found: "identity_link_failed",
};

export type AuthFailure = { code: AuthFailureCode; message: string };

/** Authentication boundary error shared with the generic API error mapper. */
export class AuthenticationError extends Error {
  readonly status = 401;
  readonly code = "authentication_required";

  constructor() {
    super("Sign in to continue.");
    this.name = "AuthenticationError";
  }
}

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
