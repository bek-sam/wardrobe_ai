import type { StudioVariantItem } from "../types";

/** The exact ordered selection the visualization snapshot is built from. */
export function snapshotSelection(items: readonly StudioVariantItem[]) {
  return items.map((item, index) => ({
    item_id: item.itemId,
    role: item.role,
    sort_order: index,
  }));
}
