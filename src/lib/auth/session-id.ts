import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The current session's identifier, taken from the verified access-token
 * claims.
 *
 * Used only to *bind* an auth action challenge to the session that requested
 * it, so a challenge minted in one session cannot be redeemed from another.
 * It is an opaque identifier, never a credential — the token itself is not
 * stored anywhere.
 *
 * Returns null when the provider does not surface the claim; callers treat
 * that as "no session binding available" and fall back to the user binding,
 * which is always present.
 */
export async function currentSessionId(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase.auth.getClaims();
  const sessionId = (data?.claims as { session_id?: unknown } | undefined)?.session_id;
  return typeof sessionId === "string" && sessionId.length > 0 ? sessionId : null;
}
