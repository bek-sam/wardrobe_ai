/**
 * Versions of the legal documents a user is asked to accept. Bumping either
 * value re-gates every existing account behind the in-app acceptance screen at
 * their next request, because `legal_acceptances` is keyed by (user, version).
 *
 * Use a date-based version so an acceptance record states exactly which text
 * was shown. Update the matching document under `src/app/(legal)` in the same
 * change, never one without the other.
 */
export const TERMS_VERSION = "2026-07-28";
export const PRIVACY_VERSION = "2026-07-28";

/** How an acceptance record came to exist. Deliberately coarse: no IP, no user agent. */
export const LEGAL_ACCEPTANCE_SOURCES = ["signup", "oauth_signup", "in_app_reacceptance"] as const;

export type LegalAcceptanceSource = (typeof LEGAL_ACCEPTANCE_SOURCES)[number];

/** Path the acceptance gate sends users to when their acceptance is stale. */
export const LEGAL_ACCEPTANCE_PATH = "/accept-terms";
