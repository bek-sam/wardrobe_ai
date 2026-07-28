/**
 * Application-level authentication events.
 *
 * These complement — never duplicate — Supabase's own Auth Audit Logs, which
 * already hold the provider-side record. What is recorded here is only what
 * the provider cannot see: which of *our* flows ran and how it ended.
 *
 * Everything below is a fixed enum value. Nothing derived from user input,
 * and by construction no email, password, OTP, TOTP code, OAuth code, CAPTCHA
 * token, action token, session token, storage path, or signed URL, ever
 * becomes an event type or a result.
 */
export const AUTH_EVENT_TYPES = [
  "signup_requested",
  "signup_completed",
  "confirmation_requested",
  "confirmation_completed",
  "login_attempted",
  "magic_link_requested",
  "oauth_started",
  "oauth_completed",
  "recovery_requested",
  "recovery_completed",
  "password_changed",
  "password_added",
  "email_change_requested",
  "email_change_completed",
  "mfa_enrolled",
  "mfa_removed",
  "mfa_challenged",
  "identity_linked",
  "identity_unlinked",
  "legal_accepted",
  "logout",
  "account_export",
  "deletion_requested",
  "deletion_auth_user_deleted",
  "deletion_completed",
  "storage_deletion_failed",
] as const;

export type AuthEventType = (typeof AUTH_EVENT_TYPES)[number];

/** Coarse outcome. Deliberately not a provider error string. */
export const AUTH_EVENT_RESULTS = ["success", "failure", "rejected", "throttled"] as const;

export type AuthEventResult = (typeof AUTH_EVENT_RESULTS)[number];
