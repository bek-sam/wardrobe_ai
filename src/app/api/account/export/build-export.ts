import type { SupabaseClient, User } from "@supabase/supabase-js";

import { throwDatabaseError } from "@/app/api/_lib/route";
import { userIdentities } from "@/lib/auth/identities";
import { getAssuranceState } from "@/lib/auth/mfa";

/** Bumped whenever the export's shape changes, so a consumer can tell versions apart. */
const EXPORT_SCHEMA_VERSION = 3;

/**
 * Assembles the account export: the relational data (through the caller's own
 * RLS-bound RPC) plus the account and consent metadata that was previously
 * missing.
 *
 * The auth section is an explicit allow-list. Access and refresh tokens,
 * provider tokens, TOTP secrets, password hashes, and raw identity payloads
 * are not merely omitted — no code path here can reach them, because each
 * field is named individually rather than spread from the provider's user.
 *
 * Storage is exported as paths and metadata, not bytes. That is unchanged and
 * intentional: the images are already downloadable through the application,
 * and inlining them would turn an export into a multi-gigabyte response.
 */
export async function buildAccountExport(supabase: SupabaseClient, user: User) {
  const { data: relational, error } = await supabase.rpc("export_my_account_data");
  throwDatabaseError(error, "Could not export account data.");

  // The Outfit Studio tables export through their own RLS-bound RPC rather
  // than being spliced into export_my_account_data(), so neither function has
  // to be rewritten wholesale when the other gains a table. Generated try-on
  // *bytes* stay out of the JSON: they are already listed under
  // `storage_objects` and downloadable by the owner through signed URLs.
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
