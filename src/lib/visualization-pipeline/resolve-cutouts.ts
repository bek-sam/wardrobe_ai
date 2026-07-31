import type { SupabaseClient } from "@supabase/supabase-js";

import { downloadPrivateObject } from "@/lib/storage/private-images";
import { sha256Hex } from "@/lib/visualization/freshness";

export type CutoutReference = {
  itemId: string;
  bucketId: string;
  storagePath: string;
  sha256: string;
};

/**
 * The item's primary cutout plus its content hash, computing and caching the
 * hash on first use. Downloading once to hash is the price of a freshness
 * signal that actually tracks bytes; every later request reads the stored
 * value and makes no storage call at all.
 */
export async function resolveCutoutReference(
  admin: SupabaseClient,
  userId: string,
  itemId: string,
): Promise<CutoutReference | null> {
  const { data, error } = await admin
    .from("wardrobe_item_images")
    .select("id, bucket_id, storage_path, content_sha256")
    .eq("user_id", userId)
    .eq("item_id", itemId)
    .eq("kind", "cutout")
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  // Deliberately not swallowed: a schema or permission problem here would
  // otherwise masquerade as "this garment has no cut-out", sending the user to
  // re-import a photo that already exists.
  if (error) throw error;
  if (!data) return null;

  const bucketId = data.bucket_id as string;
  const storagePath = data.storage_path as string;
  const cached = data.content_sha256 as string | null;
  if (cached) return { itemId, bucketId, storagePath, sha256: cached };

  const bytes = await downloadPrivateObject(admin, bucketId, storagePath, userId);
  const sha256 = sha256Hex(bytes);
  await admin
    .from("wardrobe_item_images")
    .update({ content_sha256: sha256 })
    .eq("id", data.id as string)
    .eq("user_id", userId);
  return { itemId, bucketId, storagePath, sha256 };
}
