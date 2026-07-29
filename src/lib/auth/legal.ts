import type { SupabaseClient } from "@supabase/supabase-js";

import { PRIVACY_VERSION, TERMS_VERSION, type LegalAcceptanceSource } from "@/constants/legal";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Writes the authoritative acceptance record.
 *
 * Server-side and service-role, never a client write: acceptance is evidence
 * about a user, so letting the browser assert it (via user metadata, say)
 * would make the record worth nothing. The unique key on
 * (user, terms version, privacy version) makes a retried signup or a
 * double-submitted form produce one row, not two.
 */
export async function recordLegalAcceptance(
  userId: string,
  source: LegalAcceptanceSource,
): Promise<void> {
  const { error } = await createAdminClient().rpc("record_legal_acceptance", {
    p_user_id: userId,
    p_terms_version: TERMS_VERSION,
    p_privacy_version: PRIVACY_VERSION,
    p_source: source,
  });
  // The provider's code rides along as `cause` so the route can log *why* the
  // write failed. A missing function (schema drift) and a genuine outage are
  // the same message to the user but need opposite fixes from an operator.
  if (error) throw new Error("legal_acceptance_write_failed", { cause: error.code });
}

/**
 * Whether the user has accepted the versions currently in force.
 *
 * Bumping either constant makes every existing acceptance stale, which is the
 * intended behaviour: users are re-gated at their next request instead of
 * being assumed to have agreed to text they never saw.
 *
 * Read through the caller's own client so RLS confirms ownership.
 */
export async function hasCurrentLegalAcceptance(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase
    .from("legal_acceptances")
    .select("id")
    .eq("terms_version", TERMS_VERSION)
    .eq("privacy_version", PRIVACY_VERSION)
    .limit(1)
    .maybeSingle();

  // An unreadable acceptance state is treated as "not accepted": the gate
  // re-prompts, which is recoverable, rather than waving the user through.
  if (error) return false;
  return data !== null;
}
