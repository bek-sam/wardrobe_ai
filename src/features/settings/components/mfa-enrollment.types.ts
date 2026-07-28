/**
 * Provisioning material for a new TOTP factor.
 *
 * Held in component state for the duration of the enrollment only. It is never
 * written to our database, never logged, and there is no route that can read it
 * back — once the page is left, the secret exists only in the user's
 * authenticator app.
 */
export type MfaEnrollmentData = {
  factor_id: string;
  /** SVG markup from Supabase, rendered via a data URI rather than injected. */
  qr_code: string;
  secret: string;
};
