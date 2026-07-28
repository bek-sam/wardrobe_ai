import { createHmac, timingSafeEqual } from "node:crypto";

import type { AuthActionPayload } from "./types";

/**
 * HMAC-SHA-256 over a base64url payload. Signing is sufficient here and
 * encryption would be misleading: nothing in the payload is secret, it only
 * has to be unforgeable.
 */
function signature(body: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(body).digest();
}

export function signAuthAction(payload: AuthActionPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${signature(body, secret).toString("base64url")}`;
}

/**
 * Returns the payload only when the signature verifies. Comparison is
 * constant-time so a caller cannot learn the correct signature byte by byte
 * from response timing.
 *
 * Expiry, purpose, and user binding are checked by `readAuthAction`, not here
 * — this function answers only "did we sign this?".
 */
export function verifyAuthActionSignature(token: string, secret: string): AuthActionPayload | null {
  const separator = token.indexOf(".");
  if (separator <= 0 || separator === token.length - 1) return null;

  const body = token.slice(0, separator);
  const provided = Buffer.from(token.slice(separator + 1), "base64url");
  const expected = signature(body, secret);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;

  try {
    const parsed: unknown = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return isAuthActionPayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isAuthActionPayload(value: unknown): value is AuthActionPayload {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.v === 1 &&
    typeof candidate.purpose === "string" &&
    typeof candidate.userId === "string" &&
    typeof candidate.nonce === "string" &&
    typeof candidate.issuedAt === "number" &&
    typeof candidate.expiresAt === "number"
  );
}
