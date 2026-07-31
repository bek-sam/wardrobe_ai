import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/** A tiny but genuinely decodable PNG, used as a seeded cut-out and photo. */
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/**
 * Uploads a cut-out for an item and records it, which is what makes a look
 * renderable: the studio blocks try-on for any garment with no cut-out.
 */
export async function seedCutout(admin: SupabaseClient, userId: string, itemId: string) {
  const path = `${userId}/${itemId}/cutout/${randomUUID()}.png`;
  const { error: uploadError } = await admin.storage
    .from("wardrobe-items")
    .upload(path, PNG_1X1, { contentType: "image/png", upsert: true });
  if (uploadError) throw uploadError;

  const { error } = await admin.from("wardrobe_item_images").insert({
    user_id: userId,
    item_id: itemId,
    kind: "cutout",
    bucket_id: "wardrobe-items",
    storage_path: path,
    mime_type: "image/png",
    width: 1,
    height: 1,
    file_size: PNG_1X1.byteLength,
    is_primary: true,
  });
  if (error) throw error;
  return path;
}

/**
 * An active, consented identity reference. The upload half of the consent flow
 * is covered separately; this exists so the try-on specs can start from a
 * user who has already opted in.
 */
export async function seedIdentityReference(admin: SupabaseClient, userId: string) {
  const path = `${userId}/identity/${randomUUID()}.png`;
  const { error: uploadError } = await admin.storage
    .from("profile-references")
    .upload(path, PNG_1X1, { contentType: "image/png", upsert: true });
  if (uploadError) throw uploadError;

  const { data, error } = await admin
    .from("profile_identity_references")
    .insert({
      user_id: userId,
      bucket_id: "profile-references",
      storage_path: path,
      sha256: "a".repeat(64),
      normalized_mime: "image/png",
      width: 1024,
      height: 1536,
      validation_status: "pass",
      is_active: true,
      consent_version: "tryon@2026-07",
      consented_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("identity reference seed failed");

  await admin
    .from("profiles")
    .update({
      identity_reference_path: path,
      modeled_preview_consent: true,
      modeled_preview_consent_at: new Date().toISOString(),
    })
    .eq("id", userId);
  return data.id as string;
}
