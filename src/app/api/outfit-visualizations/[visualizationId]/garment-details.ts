import type { SupabaseClient } from "@supabase/supabase-js";

import { getServerEnvironment } from "@/lib/env/server";
import { createPrivateSignedUrl } from "@/lib/storage/private-images";

import { loadGarmentRows } from "./load-garment-rows";
import type { SnapshotRow } from "./types";

/**
 * Every displayed garment fact comes from the owned wardrobe row, never from
 * the generated pixels or the localization model. A deleted or archived item
 * is represented honestly rather than silently dropped, so the UI can say
 * "this piece is no longer in your wardrobe" instead of showing nothing.
 */
export async function buildGarmentDetails(
  supabase: SupabaseClient,
  userId: string,
  snapshot: readonly SnapshotRow[],
) {
  const ttl = getServerEnvironment().SIGNED_URL_TTL_SECONDS;
  const { itemById, cutoutByItem } = await loadGarmentRows(supabase, userId, snapshot);

  return Promise.all(
    snapshot.map(async (entry) => {
      const item = itemById.get(entry.item_id) as Record<string, unknown> | undefined;
      const cutout = cutoutByItem.get(entry.item_id);
      return {
        itemId: entry.item_id,
        role: entry.role,
        sortOrder: entry.sort_order,
        hotspot: entry.hotspot,
        available: Boolean(item) && !item?.deleted_at && item?.status === "active",
        item: item ? { ...item, deleted_at: undefined } : null,
        // Signed fresh on every read and never persisted, per the storage
        // contract: only bucket + path are stored.
        cutoutUrl: cutout
          ? await createPrivateSignedUrl(
              supabase,
              cutout.bucket_id,
              cutout.storage_path,
              userId,
              ttl,
            ).catch(() => null)
          : null,
      };
    }),
  );
}
