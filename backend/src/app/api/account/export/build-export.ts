import type { SupabaseClient, User } from "@supabase/supabase-js";

import { throwDatabaseError } from "@/app/api/_lib/route";
import { userIdentities } from "@/lib/auth/server";
import { getAssuranceState } from "@/lib/auth/server";

/** Bumped whenever the export's shape changes, so a consumer can tell versions apart. */
const EXPORT_SCHEMA_VERSION = 3;

/**
 * Builds the private account export through RLS-bound RPCs and an explicit
 * allow-list of authentication fields. Keeping this outside route.ts gives
 * the DTO a direct test seam while preserving Next.js route export rules.
 */
export async function buildAccountExport(supabase: SupabaseClient, user: User) {
  const { data: relational, error } = await supabase.rpc("export_my_account_data");
  throwDatabaseError(error, "Could not export account data.");

  const { data: visualizations, error: visualizationError } = await supabase.rpc(
    "export_my_visualization_data",
  );
  throwDatabaseError(visualizationError, "Could not export try-on data.");

  const { data: legal } = await supabase
    .from("legal_acceptances")
    .select("terms_version, privacy_version, source, accepted_at")
    .order("accepted_at", { ascending: true });

  const assurance = await getAssuranceState(supabase);

  return {
    ...(relational as Record<string, unknown>),
    ...(visualizations as Record<string, unknown>),
    schema_version: EXPORT_SCHEMA_VERSION,
    account: {
      user_id: user.id,
      email: user.email ?? null,
      email_confirmed_at: user.email_confirmed_at ?? null,
      created_at: user.created_at ?? null,
      last_sign_in_at: user.last_sign_in_at ?? null,
      providers: userIdentities(user).map((identity) => ({
        provider: identity.provider,
        created_at: identity.createdAt,
        last_sign_in_at: identity.lastSignInAt,
      })),
      mfa_enabled: assurance.hasVerifiedFactor,
    },
    legal_acceptances: legal ?? [],
  };
}
