import type { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { AUTH_ACTION_COOKIE, AUTH_ACTION_TTL_SECONDS } from "../constants";

/**
 * `SameSite=Lax`, not `Strict`, and the reason is mechanical rather than a
 * preference: a recovery link is clicked in a mail client, so the whole
 * redirect chain (mail host → Supabase verify → our callback → /reset-password)
 * is cross-site initiated. Browsers withhold `Strict` cookies for the entire
 * chain, which would make the reset page unreachable for every real user.
 *
 * `Lax` still refuses to send the cookie on cross-site POSTs and subresource
 * requests, and the protection that actually stops abuse lives elsewhere: the
 * cookie is `HttpOnly` so script cannot read it, the consuming route validates
 * `Origin`, the payload is bound to one user and one purpose, it expires in
 * ten minutes, and its nonce is consumed in the database on first use.
 */
function cookieAttributes() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: AUTH_ACTION_TTL_SECONDS,
  };
}

export function setAuthActionCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set(AUTH_ACTION_COOKIE, token, cookieAttributes());
  return response;
}

/** Removes the cookie after use, or after any rejected attempt to use it. */
export function clearAuthActionCookie(response: NextResponse): NextResponse {
  response.cookies.set(AUTH_ACTION_COOKIE, "", { ...cookieAttributes(), maxAge: 0 });
  return response;
}

export async function readAuthActionCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(AUTH_ACTION_COOKIE)?.value ?? null;
}
