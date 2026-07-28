/**
 * Central authentication policy. Every schema, form hint, and document that
 * states a rule reads it from here so the server, the UI copy, and the docs
 * can never drift apart.
 */

/**
 * A password is the only factor for most accounts, so length is the control
 * that matters. Counted in Unicode code points (not UTF-16 units) so an
 * emoji or an astral-plane character counts once, the way a user sees it.
 *
 * Deliberately no composition rules (no "must contain a symbol"): they push
 * users toward predictable substitutions and break password managers, while
 * length is what actually resists guessing.
 */
export const PASSWORD_MIN_LENGTH = 15;

/**
 * Upper bound only to stop a multi-megabyte body from reaching the hashing
 * path. Well above the 128 characters a password manager may generate, and
 * passwords are never trimmed, lowercased, or Unicode-normalized before this
 * check — the bytes the user typed are the bytes that are verified.
 */
export const PASSWORD_MAX_LENGTH = 200;

/** RFC 5321 caps an address at 320 characters. */
export const EMAIL_MAX_LENGTH = 320;

/** Bounds a `returnTo` value before it is validated as a same-origin path. */
export const RETURN_TO_MAX_LENGTH = 500;

/** Where an authenticated user lands when no safe destination was requested. */
export const DEFAULT_SIGNED_IN_PATH = "/today";

/**
 * How long a one-time auth action challenge (password reset, deletion
 * reauthentication) stays valid. Short enough that a leaked cookie is of
 * little use, long enough to actually fill in a form.
 */
export const AUTH_ACTION_TTL_SECONDS = 600;

/**
 * A sensitive action must be backed by an authentication that happened
 * recently, not by a month-old session that merely has not expired yet.
 */
export const RECENT_AUTH_MAX_AGE_SECONDS = 900;

/** Cookie carrying the signed, single-use auth action challenge. */
export const AUTH_ACTION_COOKIE = "wardrobe-auth-action";

/**
 * Every email link and OAuth redirect lands on exactly one of these paths.
 * Splitting them by intent is what lets the recovery callback issue a
 * password-reset challenge while an ordinary confirmation link cannot — a
 * single shared callback would have to trust a query parameter for that.
 *
 * Each value must be registered verbatim in Supabase's redirect allow-list.
 */
export const AUTH_CALLBACK_PATHS = {
  /** Email confirmation, Google sign-in, and email-change confirmation. */
  default: "/auth/callback",
  /** Password recovery only. Issues the one-time reset challenge. */
  recovery: "/auth/callback/recovery",
  /** Passwordless sign-in for existing users. */
  magicLink: "/auth/callback/magic-link",
  /** Step-up reauthentication before a destructive action. */
  reauthenticate: "/auth/callback/reauthenticate",
} as const;

export type AuthCallbackIntent = keyof typeof AUTH_CALLBACK_PATHS;
