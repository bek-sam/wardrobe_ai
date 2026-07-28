/**
 * What a challenge authorizes. A token minted for one purpose can never be
 * presented for another: the purpose is inside the signed payload and is
 * compared on every read.
 */
export type AuthActionPurpose =
  "password_reset" | "account_deletion" | "add_password" | "sensitive_change";

/**
 * The signed body of an auth action challenge.
 *
 * Deliberately absent: access tokens, refresh tokens, provider tokens, the
 * user's email, and anything else that would turn a leaked cookie into a
 * usable credential. Everything here is either an opaque identifier or a
 * timestamp, and the token alone is useless without the matching unconsumed
 * database row.
 */
export type AuthActionPayload = {
  /** Schema version, so a future format change invalidates old tokens. */
  v: 1;
  purpose: AuthActionPurpose;
  /** The user this action is bound to. */
  userId: string;
  /** Session the challenge was issued from, when the provider exposes one. */
  sessionId: string | null;
  /** Single-use identifier; the matching row is what makes replay fail. */
  nonce: string;
  /** UNIX seconds. */
  issuedAt: number;
  /** UNIX seconds. */
  expiresAt: number;
};
