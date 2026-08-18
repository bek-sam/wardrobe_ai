import type { SignInWithOAuthCredentials } from "@supabase/supabase-js";

/**
 * Google OAuth parameters, in one place so sign-in, linking, and
 * reauthentication cannot drift apart.
 *
 * Scopes are exactly OpenID Connect's `openid email profile` — enough to
 * identify the user and nothing more. The application never calls a Google
 * API, so it never asks for Drive, Calendar, or offline access, and therefore
 * never receives a provider refresh token it would then have to protect.
 *
 * `skipBrowserRedirect` is required because this runs on the server: we want
 * the URL back so the route can emit its own redirect, rather than the SDK
 * trying to navigate a browser that is not there.
 */
export function googleOAuthOptions(
  redirectTo: string,
  forceAccountPrompt = false,
): SignInWithOAuthCredentials {
  return {
    provider: "google",
    options: {
      redirectTo,
      scopes: "openid email profile",
      skipBrowserRedirect: true,
      // Reauthentication must be a deliberate act. Without this, Google
      // silently reuses its existing session and the "confirm it is you" step
      // becomes a redirect the user never sees.
      ...(forceAccountPrompt ? { queryParams: { prompt: "select_account consent" } } : {}),
    },
  };
}
