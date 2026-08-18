import type { SupabaseClient } from "@supabase/supabase-js";

import { LEGAL_ACCEPTANCE_PATH } from "@/constants/legal";
import { hasCurrentLegalAcceptance } from "@/lib/auth/server";
import { getAssuranceState } from "@/lib/auth/server";

/**
 * Where a user goes once the *first* factor has succeeded.
 *
 * Ordering is a security property, not a preference. The MFA check comes
 * first, so a session that still owes a second factor never reaches a page
 * that reads wardrobe data — and, critically, the caller's requested
 * `returnTo` cannot be used to skip past it. Only after assurance is settled
 * does the legal gate get a say.
 */
export async function destinationAfterFirstFactor(
  supabase: SupabaseClient,
  returnTo: string,
): Promise<string> {
  const assurance = await getAssuranceState(supabase);
  if (assurance.needsChallenge) {
    return `/mfa/verify?returnTo=${encodeURIComponent(returnTo)}`;
  }

  if (!(await hasCurrentLegalAcceptance(supabase))) {
    return `${LEGAL_ACCEPTANCE_PATH}?returnTo=${encodeURIComponent(returnTo)}`;
  }

  return returnTo;
}
