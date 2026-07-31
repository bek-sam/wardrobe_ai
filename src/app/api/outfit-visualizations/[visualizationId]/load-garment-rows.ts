import type { SupabaseClient } from "@supabase/supabase-js";

import type { SnapshotRow } from "./types";

/** Only user-confirmed catalog fields; nothing derived from generated pixels. */
const GARMENT_FIELDS =
  "id, name, brand, category, subcategory, primary_color_hex, secondary_color_hex, color_names, pattern, fit, silhouette, materials, size_label, care_instructions, availability_status, status, wear_count, last_worn_at, favorite, metadata_confidence, deleted_at";

export async function loadGarmentRows(
  supabase: SupabaseClient,
  userId: string,
  snapshot: readonly SnapshotRow[],
) {
  const itemIds = snapshot.map((entry) => entry.item_id);
  const [{ data: items }, { data: cutouts }] = await Promise.all([
    supabase.from("wardrobe_items").select(GARMENT_FIELDS).eq("user_id", userId).in("id", itemIds),
    supabase
      .from("wardrobe_item_images")
      .select("item_id, bucket_id, storage_path, is_primary")
      .eq("user_id", userId)
      .eq("kind", "cutout")
      .in("item_id", itemIds)
      .order("is_primary", { ascending: false }),
  ]);

  const cutoutByItem = new Map<string, { bucket_id: string; storage_path: string }>();
  for (const row of cutouts ?? []) {
    const itemId = row.item_id as string;
    if (!cutoutByItem.has(itemId)) {
      cutoutByItem.set(itemId, {
        bucket_id: row.bucket_id as string,
        storage_path: row.storage_path as string,
      });
    }
  }

  return {
    itemById: new Map((items ?? []).map((item) => [item.id as string, item])),
    cutoutByItem,
  };
}
