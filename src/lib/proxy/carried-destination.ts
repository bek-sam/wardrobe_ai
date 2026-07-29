import { safeReturnTo } from "@/lib/auth/redirects";

import { SIGNED_OUT_ONLY_ROUTES } from "./public-routes.data";

/**
 * Where a user should be sent once they satisfy whatever the redirect demands.
 *
 * Normally that is simply the page they asked for. The exception is a
 * signed-out-only route: a user who still owes a second factor and loads
 * `/login?returnTo=/wardrobe` would otherwise be sent to `/mfa/verify` carrying
 * `/login?returnTo=/wardrobe` as the destination. Passing the challenge then
 * returns them to `/login`, which — now that they are signed in — bounces
 * straight to the default page, silently discarding the `/wardrobe` they
 * actually asked for.
 *
 * So for those routes the *inner* `returnTo` is carried instead, which is the
 * real destination, and `safeReturnTo` reduces it to the default when there
 * isn't one. It also re-sanitizes: the value arrives from a query string, and
 * nothing may reach a `Location` header without passing that check.
 */
export function carriedDestination(url: URL): string {
  if (!SIGNED_OUT_ONLY_ROUTES.has(url.pathname)) {
    return `${url.pathname}${url.search}`;
  }

  return safeReturnTo(url.searchParams.get("returnTo"));
}
