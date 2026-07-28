import type { SupabaseClient } from "@supabase/supabase-js";

import { ApiError } from "@/lib/api/response";

export type AssuranceState = {
  currentLevel: string | null;
  nextLevel: string | null;
  /** The account has at least one *verified* factor. */
  hasVerifiedFactor: boolean;
  /** Verified factor exists but this session has not satisfied it yet. */
  needsChallenge: boolean;
  /**
   * The session's `amr` claim, either as RFC-8176 strings or as objects with
   * timestamps. Timestamps drive the server-side recency check and are never
   * forwarded to the browser.
   */
  currentAuthenticationMethods: readonly (string | { method?: string; timestamp?: number })[];
};

/**
 * Reads the session's assurance level. Supabase reports `nextLevel === "aal2"`
 * exactly when the account has a verified factor, so that single comparison
 * distinguishes "no MFA on this account" from "MFA enrolled but not yet
 * satisfied on this session".
 *
 * Errors are treated as a missing session rather than as "no MFA": an
 * unreadable assurance level must never be the reason a step-up check passes.
 */
export async function getAssuranceState(supabase: SupabaseClient): Promise<AssuranceState> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) {
    throw new ApiError(401, "authentication_required", "Sign in again to continue.");
  }

  const hasVerifiedFactor = data.nextLevel === "aal2";
  return {
    currentLevel: data.currentLevel,
    nextLevel: data.nextLevel,
    hasVerifiedFactor,
    needsChallenge: hasVerifiedFactor && data.currentLevel !== "aal2",
    currentAuthenticationMethods: data.currentAuthenticationMethods ?? [],
  };
}

/**
 * Gate for sensitive actions. A user with no factor passes at AAL1 (they have
 * nothing to step up to); a user with a verified factor must have satisfied it
 * on this session.
 */
export async function requireAal2(supabase: SupabaseClient): Promise<AssuranceState> {
  const state = await getAssuranceState(supabase);
  if (state.needsChallenge) {
    throw new ApiError(403, "mfa_required", "Enter your authenticator code to continue.");
  }
  return state;
}
