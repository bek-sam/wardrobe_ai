import type { SupabaseClient } from "@supabase/supabase-js";

import { ApiError } from "@/lib/api/response";
import type { VisualizationSnapshotItem } from "@/lib/visualization";

import { resolveCutoutReference } from "./resolve-cutouts";
import type { SourceSelection } from "./resolve-source-items";

/**
 * Turns an ordered selection into the immutable snapshot the visualization is
 * pinned to. A garment with no approved cutout blocks the whole request with a
 * named, actionable error rather than being silently dropped — omitting a
 * foundation piece would render an outfit the user never asked for.
 */
export async function buildVisualizationSnapshot(
  admin: SupabaseClient,
  userId: string,
  selections: readonly SourceSelection[],
): Promise<VisualizationSnapshotItem[]> {
  const ordered = [...selections].sort((first, second) => first.sort_order - second.sort_order);
  const snapshot: VisualizationSnapshotItem[] = [];

  for (const [index, selection] of ordered.entries()) {
    const cutout = await resolveCutoutReference(admin, userId, selection.item_id);
    if (!cutout) {
      throw new ApiError(
        422,
        "missing_cutout",
        "One of these pieces has no cut-out photo yet, so it cannot be rendered. Re-import it through the photo flow to add one.",
        { itemId: selection.item_id },
      );
    }
    snapshot.push({
      itemId: selection.item_id,
      role: selection.role,
      sortOrder: index,
      cutoutBucketId: cutout.bucketId,
      cutoutStoragePath: cutout.storagePath,
      cutoutSha256: cutout.sha256,
    });
  }

  return snapshot;
}
