import type { SupabaseClient } from "@supabase/supabase-js";

import type { ActiveIdentityReference } from "./types";

/**
 * The single active reference, or null. The database's partial unique index
 * guarantees there is at most one, so this never has to disambiguate.
 */
export async function loadActiveIdentityReference(
  client: SupabaseClient,
  userId: string,
): Promise<ActiveIdentityReference | null> {
  const { data, error } = await client
    .from("profile_identity_references")
    .select("id, bucket_id, storage_path, sha256, consent_version")
    .eq("user_id", userId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data || !data.consent_version) return null;

  return {
    id: data.id as string,
    bucketId: data.bucket_id as string,
    storagePath: data.storage_path as string,
    sha256: data.sha256 as string,
    consentVersion: data.consent_version as string,
  };
}
