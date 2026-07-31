import type { SupabaseClient } from "@supabase/supabase-js";

import { getServerEnvironment } from "@/lib/env/server";
import { createPrivateSignedUrl } from "@/lib/storage/private-images";
import { TRYON_CONSENT_VERSION } from "@/lib/visualization";
import { isVisualizationConfigured } from "@/lib/ai/visualization-provider";

/**
 * The consent gate's state in one call: the active reference (if any), the
 * most recent candidate awaiting review, and whether the deployment can
 * generate at all. The preview URL is signed fresh here and never persisted.
 */
export async function handleGetIdentityReferences(supabase: SupabaseClient, userId: string) {
  const environment = getServerEnvironment();
  const { data, error } = await supabase
    .from("profile_identity_references")
    .select(
      "id, storage_path, width, height, validation_status, validation_summary, is_active, consent_version, consented_at, created_at",
    )
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) throw error;

  const rows = data ?? [];
  const active = rows.find((row) => row.is_active) ?? null;
  const pending = rows.find((row) => !row.is_active && row.validation_status !== "fail") ?? null;
  const signable = active ?? pending;
  const previewUrl = signable
    ? await createPrivateSignedUrl(
        supabase,
        environment.PROFILE_REFERENCES_BUCKET,
        signable.storage_path as string,
        userId,
        environment.SIGNED_URL_TTL_SECONDS,
      ).catch(() => null)
    : null;

  return {
    active: active ? { ...active, storage_path: undefined } : null,
    pending: pending ? { ...pending, storage_path: undefined } : null,
    previewUrl,
    consentVersion: TRYON_CONSENT_VERSION,
    consentCurrent: active?.consent_version === TRYON_CONSENT_VERSION,
    tryOnConfigured: isVisualizationConfigured(),
  };
}
