import type { User, UserIdentity } from "@supabase/supabase-js";

import { AUTH_PROVIDERS, isSupportedProvider, type SupportedProvider } from "./providers.data";

/** The only identity fields that may reach the browser. */
export type LinkedIdentity = {
  identityId: string;
  provider: SupportedProvider;
  label: string;
  recoveryCapable: boolean;
  createdAt: string | null;
  lastSignInAt: string | null;
};

/**
 * Projects Supabase identities onto our own shape.
 *
 * `identity_data` is dropped entirely: it is a raw provider payload that can
 * carry profile pictures, locales, hosted-domain hints, and provider subject
 * identifiers we have no reason to expose. Unrecognized providers are dropped
 * too — surfacing a method the app cannot actually manage would produce
 * buttons that do nothing.
 */
export function normalizeIdentities(identities: readonly UserIdentity[]): LinkedIdentity[] {
  return identities.flatMap((identity) => {
    if (!isSupportedProvider(identity.provider)) return [];
    const definition = AUTH_PROVIDERS[identity.provider];
    return [
      {
        identityId: identity.identity_id,
        provider: identity.provider,
        label: definition.label,
        recoveryCapable: definition.recoveryCapable,
        createdAt: identity.created_at ?? null,
        lastSignInAt: identity.last_sign_in_at ?? null,
      },
    ];
  });
}

export function userIdentities(user: User): LinkedIdentity[] {
  return normalizeIdentities(user.identities ?? []);
}

/** An `email` identity is the only thing that proves a password exists. */
export function hasPasswordIdentity(identities: readonly LinkedIdentity[]): boolean {
  return identities.some((identity) => identity.provider === "email");
}
