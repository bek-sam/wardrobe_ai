import type { SupabaseClient, User } from "@supabase/supabase-js";

import type { AccountSecurity } from "@/features/settings";
import { getAuthFlags } from "@/lib/auth/server";
import { hasPasswordIdentity, userIdentities } from "@/lib/auth/server";
import { getAssuranceState } from "@/lib/auth/server";

function sessionMethods(methods: readonly (string | { method?: string })[]): string[] {
  return methods.flatMap((entry) => {
    const name = typeof entry === "string" ? entry : entry.method;
    return typeof name === "string" && name.length > 0 ? [name] : [];
  });
}

/**
 * Projects the provider user onto the narrow DTO the browser may receive.
 * The explicit allow-list prevents provider metadata and factor secrets from
 * leaking into the response.
 */
export async function buildAccountSecurity(
  supabase: SupabaseClient,
  user: User,
): Promise<AccountSecurity> {
  const identities = userIdentities(user);
  const assurance = await getAssuranceState(supabase);
  const { data: factorData } = await supabase.auth.mfa.listFactors();
  const verifiedFactors = (factorData?.totp ?? []).map((factor) => ({
    id: factor.id,
    friendlyName: factor.friendly_name ?? null,
    createdAt: factor.created_at ?? null,
  }));
  const flags = getAuthFlags();

  return {
    userId: user.id,
    email: user.email ?? null,
    emailConfirmed: Boolean(user.email_confirmed_at),
    emailConfirmedAt: user.email_confirmed_at ?? null,
    pendingEmail: user.new_email ?? null,
    createdAt: user.created_at ?? null,
    lastSignInAt: user.last_sign_in_at ?? null,
    identities,
    hasPassword: hasPasswordIdentity(identities),
    mfaEnabled: assurance.hasVerifiedFactor,
    factors: verifiedFactors,
    assuranceLevel: assurance.currentLevel,
    currentAuthenticationMethods: sessionMethods(assurance.currentAuthenticationMethods),
    googleAuthEnabled: flags.googleAuthEnabled,
    magicLinkEnabled: flags.magicLinkEnabled,
  };
}
