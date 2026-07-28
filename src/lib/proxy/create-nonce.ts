/**
 * A fresh CSP nonce per request.
 *
 * Uses Web Crypto rather than `node:crypto` because the proxy runs in the Edge
 * runtime. 16 bytes is well past the 128 bits of entropy a nonce needs to be
 * unguessable — the whole guarantee rests on an attacker being unable to
 * predict it, since a predictable nonce is no better than `unsafe-inline`.
 */
export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}
