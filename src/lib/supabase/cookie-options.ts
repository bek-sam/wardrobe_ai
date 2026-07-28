import type { CookieOptions } from "@supabase/ssr";

/**
 * One cookie configuration shared by the proxy client, the server client, and
 * the browser client, so a session cookie written during a proxy refresh has
 * exactly the attributes of one written by a route handler.
 *
 * `httpOnly` is deliberately **not** set. The browser Supabase client reads
 * these tokens directly in order to create signed URLs against the private
 * Storage buckets without proxying every image through this application. That
 * is an accepted architectural tradeoff, not an oversight: it means a script
 * injection would be able to read the session, which is why the production CSP
 * removes `script-src 'unsafe-inline'` and pins every source to an exact
 * origin. Do not describe these cookies as HttpOnly anywhere.
 *
 * `maxAge`/`expires` are also left unset so Supabase keeps its own long-lived
 * cookie lifetime. Session length is enforced server-side by the project's JWT
 * expiry, refresh-token rotation, inactivity timeout, and maximum session
 * lifetime — shortening the cookie here would only log users out early while
 * leaving an already-issued refresh token just as valid.
 */
export function supabaseCookieOptions(): CookieOptions {
  return {
    path: "/",
    // Lax still sends the cookie on the top-level GET navigations that OAuth
    // and email links rely on, while withholding it from cross-site POSTs.
    // Every state-changing route additionally validates Origin.
    sameSite: "lax",
    // Never over plaintext in production. Local development runs on
    // http://127.0.0.1, where a Secure cookie would simply be dropped.
    secure: process.env.NODE_ENV === "production",
    // No `domain`: the cookie stays host-only instead of being shared with
    // every subdomain, including any that might later be operated by others.
  };
}
