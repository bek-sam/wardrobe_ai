import { createHmac } from "node:crypto";

/**
 * A minimal RFC 6238 TOTP generator, for tests only.
 *
 * Enrolling a factor for real — rather than writing a row into
 * `auth.mfa_factors` — is what makes the MFA tests meaningful: they exercise
 * Supabase's own enrollment and verification path, and therefore the actual
 * `aal` claim that the RLS predicate reads.
 *
 * Never used by application code, and it must not be: this generates codes
 * from a secret, which is the authenticator's job, not the server's.
 */
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(input: string): Buffer {
  const cleaned = input.replace(/=+$/, "").replace(/\s/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const character of cleaned) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index === -1) throw new Error(`Invalid base32 character: ${character}`);
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >>> bits) & 0xff);
    }
  }

  return Buffer.from(bytes);
}

/**
 * Waits until the next time step starts.
 *
 * A TOTP code may be redeemed exactly once. A test that enrols a factor and
 * then answers a sign-in challenge within the same 30-second step generates the
 * identical six digits both times, and the second use is refused as a replay —
 * which is indistinguishable from a wrong code unless you know to look for it.
 * Waiting for a fresh step is what a real user does by simply being slower.
 */
export function waitForNextTotpStep(stepSeconds = 30): Promise<void> {
  const elapsed = Math.floor(Date.now() / 1000) % stepSeconds;
  return new Promise((resolve) => setTimeout(resolve, (stepSeconds - elapsed + 1) * 1000));
}

export function generateTotp(secret: string, atMs: number = Date.now(), stepSeconds = 30): string {
  const counter = Math.floor(atMs / 1000 / stepSeconds);
  const counterBytes = Buffer.alloc(8);
  counterBytes.writeBigUInt64BE(BigInt(counter));

  const digest = createHmac("sha1", base32Decode(secret)).update(counterBytes).digest();
  // Dynamic truncation: the low nibble of the last byte selects the offset.
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);

  return String(binary % 1_000_000).padStart(6, "0");
}
