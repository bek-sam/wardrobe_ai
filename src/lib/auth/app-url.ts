import { getServerEnvironment } from "@/lib/env/server";

import { AUTH_CALLBACK_PATHS, type AuthCallbackIntent } from "./constants";

/**
 * Builds an absolute URL from the *configured* application origin rather than
 * the incoming request. Email links are the reason: a forged Host header on
 * the request that triggers a recovery email would otherwise end up baked into
 * the link the real account owner receives.
 */
export function canonicalAppUrl(path: string = "/"): string {
  return new URL(path, getServerEnvironment().NEXT_PUBLIC_APP_URL).toString();
}

/**
 * The exact callback URL for one auth intent. `returnTo` is carried as a query
 * parameter and re-sanitized on arrival; it is never trusted on the way back.
 */
export function authCallbackUrl(intent: AuthCallbackIntent, returnTo?: string): string {
  const url = new URL(AUTH_CALLBACK_PATHS[intent], getServerEnvironment().NEXT_PUBLIC_APP_URL);
  if (returnTo) url.searchParams.set("returnTo", returnTo);
  return url.toString();
}
