import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getServerEnvironment } from "@/lib/env/server";
import { uploadPrivateObject } from "@/lib/storage/private-images";
import type { IdentityReferenceAssessment } from "@/lib/visualization";

import { IDENTITY_PATH_PREFIX } from "./limits.data";
import { validationStatusFor } from "./assess-suitability";
import type { NormalizedIdentityUpload } from "./types";

/**
 * Persists the *normalized* bytes at a fully server-constructed path. The raw
 * client-uploaded object is never referenced by the row — its path came from
 * the browser and is only ever used once, to read bytes, before being queued
 * for deletion by the caller.
 */
export async function storeIdentityReference(
  admin: SupabaseClient,
  userId: string,
  normalized: NormalizedIdentityUpload,
  assessment: IdentityReferenceAssessment,
) {
  const environment = getServerEnvironment();
  const bucket = environment.PROFILE_REFERENCES_BUCKET;
  const path = `${userId}/${IDENTITY_PATH_PREFIX}/${randomUUID()}.png`;
  await uploadPrivateObject(admin, bucket, path, userId, normalized.bytes, normalized.mimeType);

  const { data, error } = await admin
    .from("profile_identity_references")
    .insert({
      user_id: userId,
      bucket_id: bucket,
      storage_path: path,
      sha256: normalized.sha256,
      normalized_mime: normalized.mimeType,
      width: normalized.width,
      height: normalized.height,
      validation_status: validationStatusFor(assessment),
      validation_summary: assessment,
    })
    .select("id, storage_path, width, height, validation_status, validation_summary, created_at")
    .single();
  if (error) throw error;
  return data;
}
