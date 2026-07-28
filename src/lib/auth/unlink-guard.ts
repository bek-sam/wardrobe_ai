import type { LinkedIdentity } from "./identities";
import type { SupportedProvider } from "./providers.data";

export type UnlinkRefusal = "not_linked" | "last_identity" | "last_recovery_method";

export type UnlinkDecision = { allowed: true } | { allowed: false; reason: UnlinkRefusal };

/**
 * Decides whether an identity may be removed.
 *
 * Two separate guards, because they fail in different ways. Removing the
 * *last* identity would leave an account nobody — including its owner — can
 * ever sign into again; Supabase refuses this too, but relying on a provider
 * error to enforce our own account model means the UI only finds out after the
 * user has confirmed. Removing the last *recovery-capable* method is subtler:
 * the account stays reachable today, yet the moment that one credential is
 * lost there is no way back in.
 *
 * The caller is expected to have already confirmed the identity belongs to the
 * authenticated user.
 */
export function canUnlinkIdentity(
  identities: readonly LinkedIdentity[],
  identityId: string,
): UnlinkDecision {
  const target = identities.find((identity) => identity.identityId === identityId);
  if (!target) return { allowed: false, reason: "not_linked" };
  if (identities.length <= 1) return { allowed: false, reason: "last_identity" };

  if (target.recoveryCapable) {
    const otherRecovery = identities.some(
      (identity) => identity.identityId !== identityId && identity.recoveryCapable,
    );
    if (!otherRecovery) return { allowed: false, reason: "last_recovery_method" };
  }

  return { allowed: true };
}

/** Convenience for provider-named requests once the provider has been validated. */
export function identityForProvider(
  identities: readonly LinkedIdentity[],
  provider: SupportedProvider,
): LinkedIdentity | null {
  return identities.find((identity) => identity.provider === provider) ?? null;
}
