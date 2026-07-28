import type { SupabaseClient } from "@supabase/supabase-js";

import type { RouteState } from "./resolve-route";

/**
 * Reads just enough session state to route the request.
 *
 * Identity comes from `getClaims()`, which verifies the token's signature, so
 * a forged cookie is not accepted as a session. Assurance comes from
 * `getAuthenticatorAssuranceLevel()`, which decodes the stored session locally
 * and needs no network round trip — important, since this runs on every
 * request.
 *
 * This is a *routing* signal, not the security boundary. What actually stops
 * an under-assured session from reading private rows is the restrictive RLS
 * added in 202607280002; this only makes the experience a redirect instead of
 * a wall of permission errors.
 */
export async function readSessionState(supabase: SupabaseClient): Promise<RouteState> {
  const { data } = await supabase.auth.getClaims();
  const signedIn = typeof data?.claims?.sub === "string";
  if (!signedIn) return { signedIn: false, needsMfa: false };

  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const needsMfa = assurance?.nextLevel === "aal2" && assurance.currentLevel !== "aal2";

  return { signedIn: true, needsMfa };
}
