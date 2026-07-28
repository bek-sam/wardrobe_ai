import { GoogleLogo } from "@phosphor-icons/react/ssr";

import { clientEnv } from "@/lib/env/client";

/**
 * "Continue with Google" — rendered only when the provider is actually
 * configured.
 *
 * A permanently disabled button captioned "Google sign-in has not been enabled
 * yet" is worse than no button: it advertises a method that does not exist.
 * When the flag is off, this renders nothing.
 *
 * It posts to our own origin rather than linking straight to the provider, so
 * the flow still gets the CSRF origin check, the server-side feature flag, and
 * `returnTo` sanitizing before the browser leaves.
 */
export function OAuthGoogleButton({
  returnTo,
  label = "Continue with Google",
}: {
  returnTo?: string;
  label?: string;
}) {
  if (!clientEnv.googleAuthEnabled) return null;

  return (
    <form action="/api/auth/oauth/google" className="oauth-form" method="post">
      <input name="intent" type="hidden" value="signin" />
      {returnTo ? <input name="returnTo" type="hidden" value={returnTo} /> : null}
      <button className="oauth-button" type="submit">
        <GoogleLogo aria-hidden="true" size={19} weight="bold" /> {label}
      </button>
    </form>
  );
}
