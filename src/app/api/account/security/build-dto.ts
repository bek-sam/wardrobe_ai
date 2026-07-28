import type { SupabaseClient, User } from "@supabase/supabase-js";

import type { AccountSecurity } from "@/features/settings/account-security.types";
import { hasPasswordIdentity, userIdentities } from "@/lib/auth/identities";
import { getAssuranceState } from "@/lib/auth/mfa";
import { getAuthFlags } from "@/lib/auth/flags";

/**
 * Method names from the `amr` claim, which Supabase reports either as plain
 * strings or as objects carrying timestamps. Only the names are forwarded: the
 * timestamps drive the server-side recency check and have no business being
 * readable in the browser.
 */
function sessionMethods(methods: readonly (string | { method?: string })[]): string[] {
  return methods.flatMap((entry) => {
    const name = typeof entry === "string" ? entry : entry.method;
    return typeof name === "string" && name.length > 0 ? [name] : [];
  });
}

/**
 * Projects the provider's user onto the narrow DTO the browser is allowed to
 * see. Every field is copied explicitly — there is no spread of the Supabase
 * user anywhere in this function, so a future provider field cannot leak by
 * simply appearing.
 *
 * Factors are reduced to id, friendly name, and creation time. A factor's
 * secret is not present in `listFactors` at all, and nothing here would carry
 * it if it were.
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
