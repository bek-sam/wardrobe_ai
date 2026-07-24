import type { SupabaseClient } from "@supabase/supabase-js";

import { throwDatabaseError, throwNotFound } from "@/app/api/_lib/route";
import { getServerEnvironment } from "@/lib/env/server";
import { createPrivateSignedUrl } from "@/lib/storage/private-images";

// Signed URLs are short-lived and must never be persisted (see
// retrieveStoredOutfitCandidates), so any caller that wants to actually
// display a ready preview image -- live or from stylist chat history --
// fetches a fresh one here instead of storing one.
export async function handleGetPreview(
  supabase: SupabaseClient,
  userId: string,
  candidateId: string,
) {
  const { data, error } = await supabase
    .from("outfit_candidates")
    .select("preview_status, preview_bucket, preview_storage_path")
    .eq("id", candidateId)
    .eq("user_id", userId)
    .maybeSingle();
  throwDatabaseError(error, "Could not load the outfit candidate.");
  if (!data) throwNotFound("Outfit candidate");

  if (data.preview_status !== "ready" || !data.preview_bucket || !data.preview_storage_path) {
    return { status: data.preview_status, previewUrl: null };
  }

  const environment = getServerEnvironment();
  const previewUrl = await createPrivateSignedUrl(
    supabase,
    data.preview_bucket,
    data.preview_storage_path,
    userId,
    environment.SIGNED_URL_TTL_SECONDS,
  );
  return { status: "ready" as const, previewUrl };
}
