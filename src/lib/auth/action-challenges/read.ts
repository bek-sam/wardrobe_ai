import { verifyAuthActionSignature } from "./token";
import type { AuthActionPayload, AuthActionPurpose } from "./types";

export type AuthActionRejection =
  "missing" | "invalid_signature" | "wrong_purpose" | "wrong_user" | "expired";

export type AuthActionRead =
  { ok: true; payload: AuthActionPayload } | { ok: false; reason: AuthActionRejection };

/**
 * Validates every binding on a challenge before it may authorize anything.
 *
 * All four checks matter independently: a valid signature on a token minted
 * for a *different purpose* would let a reauthentication link authorize a
 * password change, and one minted for a *different user* is the exact shape of
 * the "reauthenticate as yourself, delete someone else" attack. Replay is
 * blocked separately, by consuming the nonce in the database.
 */
export function readAuthAction(
  token: string | null | undefined,
  secret: string,
  expected: { purpose: AuthActionPurpose; userId: string; now?: number },
): AuthActionRead {
  if (!token) return { ok: false, reason: "missing" };

  const payload = verifyAuthActionSignature(token, secret);
  if (!payload) return { ok: false, reason: "invalid_signature" };
  if (payload.purpose !== expected.purpose) return { ok: false, reason: "wrong_purpose" };
  if (payload.userId !== expected.userId) return { ok: false, reason: "wrong_user" };

  const nowSeconds = (expected.now ?? Date.now()) / 1000;
  if (payload.expiresAt <= nowSeconds) return { ok: false, reason: "expired" };

  return { ok: true, payload };
}
