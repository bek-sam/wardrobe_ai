/**
 * The sign-in methods this application knows about.
 *
 * A registry rather than scattered string comparisons, so adding Apple or
 * passkeys later means one entry here plus a feature flag — not an audit of
 * every place that asks "is this the last identity?" or "can this method
 * recover an account?".
 *
 * `recoveryCapable` marks a method that can get a user back in on its own. It
 * is what stops the UI from silently unlinking someone's only route back into
 * their account.
 */
export const AUTH_PROVIDERS = {
  email: {
    id: "email",
    label: "Email and password",
    recoveryCapable: true,
    /** Linked implicitly by signing up or adding a password, never via OAuth. */
    linkable: false,
  },
  google: {
    id: "google",
    label: "Google",
    recoveryCapable: true,
    linkable: true,
  },
} as const;

export type SupportedProvider = keyof typeof AUTH_PROVIDERS;

export const SUPPORTED_PROVIDERS = Object.keys(AUTH_PROVIDERS) as SupportedProvider[];

/**
 * Narrows an untrusted string. Client requests name a provider, and anything
 * outside this list must be rejected rather than forwarded to the provider
 * API — that is what keeps `provider=saml` or a typo from reaching Supabase.
 */
export function isSupportedProvider(value: unknown): value is SupportedProvider {
  return typeof value === "string" && Object.hasOwn(AUTH_PROVIDERS, value);
}
