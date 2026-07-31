import type { VisualizationGarmentInput } from "@/lib/ai/visualization-provider";
import { downloadPrivateObject } from "@/lib/storage/private-images";

import type { AdminClient, SnapshotItemRow } from "./types";

/**
 * Downloads each snapshot cutout and pairs it with the item's *confirmed*
 * wardrobe facts. imageNumber starts at 2 because Image 1 is always the
 * identity reference — the prompt builder and the provider payload rely on
 * exactly this numbering, so it is assigned once, here.
 */
export async function loadGarmentInputs(
  admin: AdminClient,
  userId: string,
  items: readonly SnapshotItemRow[],
): Promise<VisualizationGarmentInput[]> {
  const ordered = [...items].sort((first, second) => first.sort_order - second.sort_order);
  const { data: rows } = await admin
    .from("wardrobe_items")
    .select("id, name, color_names, pattern, fit, silhouette, materials")
    .eq("user_id", userId)
    .in(
      "id",
      ordered.map((item) => item.item_id),
    );
  const byId = new Map((rows ?? []).map((row) => [row.id as string, row]));

  return Promise.all(
    ordered.map(async (item, index) => {
      const row = byId.get(item.item_id);
      const materials = row?.materials;
      return {
        imageNumber: index + 2,
        itemId: item.item_id,
        role: item.role,
        name: (row?.name as string | undefined) ?? "wardrobe item",
        colorNames: (row?.color_names as string[] | undefined) ?? [],
        pattern: (row?.pattern as string | null | undefined) ?? null,
        fit: (row?.fit as string | null | undefined) ?? null,
        silhouette: (row?.silhouette as string | null | undefined) ?? null,
        materials: Array.isArray(materials) ? materials.map(String).slice(0, 4) : [],
        cutout: await downloadPrivateObject(
          admin,
          item.cutout_bucket_id,
          item.cutout_storage_path,
          userId,
        ),
      };
    }),
  );
}
