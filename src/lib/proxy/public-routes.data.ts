/** Reachable without a session. */
export const PUBLIC_ROUTES = new Set([
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/magic-link",
  "/check-email",
  "/reset-password",
  "/account-deleted",
  "/privacy",
  "/terms",
  "/auth/callback",
  "/auth/callback/recovery",
  "/auth/callback/magic-link",
  "/auth/callback/reauthenticate",
]);

/** Signed-in users are bounced off these back into the app. */
export const SIGNED_OUT_ONLY_ROUTES = new Set([
  "/login",
  "/signup",
  "/forgot-password",
  "/magic-link",
]);

/**
 * Reachable by a session that still owes its second factor.
 *
 * Kept to the minimum needed to *finish* authenticating or to back out of it.
 * Anything more would defeat the purpose: a session at aal1 belonging to an
 * enrolled account is precisely the situation the second factor exists to
 * contain.
 *
 * `/reset-password` is included because a user who forgot their password and
 * has MFA enrolled arrives at aal1 and must still be able to finish the reset.
 * That page is guarded by its own single-use challenge, not by assurance level.
 */
export const MFA_PENDING_ROUTES = new Set([
  "/mfa/verify",
  "/reset-password",
  "/account-deleted",
  "/privacy",
  "/terms",
]);
