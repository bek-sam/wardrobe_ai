import { getServerEnvironment } from "@/lib/env/server";

export type AuthFeatureFlags = {
  publicSignupEnabled: boolean;
  googleAuthEnabled: boolean;
  magicLinkEnabled: boolean;
  captchaEnabled: boolean;
  turnstileSiteKey: string | null;
};

/**
 * Resolves the authentication feature flags for server code. Every flag
 * defaults to off, so an unset or misspelled variable disables the feature
 * rather than exposing a half-configured one.
 *
 * CAPTCHA is the one flag that can be *inconsistently* configured: the site
 * key lives here while the secret that actually validates tokens lives in
 * Supabase. A flag set without a site key would render no widget yet still
 * demand a token, locking every user out, so it is treated as a hard
 * configuration error instead of being silently downgraded.
 */
export function getAuthFlags(): AuthFeatureFlags {
  const environment = getServerEnvironment();
  const captchaEnabled = environment.NEXT_PUBLIC_CAPTCHA_ENABLED;
  const turnstileSiteKey = environment.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null;

  if (captchaEnabled && !turnstileSiteKey) {
    throw new Error(
      "NEXT_PUBLIC_CAPTCHA_ENABLED is set without NEXT_PUBLIC_TURNSTILE_SITE_KEY. " +
        "Set the site key here and the matching secret in Supabase, or disable CAPTCHA.",
    );
  }

  return {
    publicSignupEnabled: environment.PUBLIC_SIGNUP_ENABLED,
    googleAuthEnabled: environment.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED,
    magicLinkEnabled: environment.NEXT_PUBLIC_EMAIL_MAGIC_LINK_ENABLED,
    captchaEnabled,
    turnstileSiteKey,
  };
}
