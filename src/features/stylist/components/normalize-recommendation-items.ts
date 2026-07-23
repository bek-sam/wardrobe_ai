import { isObject, safeString } from "@/lib/api/normalize";
import type { OutfitItemRole } from "@/features/outfits/types";

import { roles, uuidPattern } from "./stylist-constants.data";
import type { OutfitSelection } from "./stylist.types";

export function normalizeStylistItems(rawItems: unknown[]): OutfitSelection[] | null {
  const items: OutfitSelection[] = [];
  const itemIds = new Set<string>();
  for (const [index, entry] of rawItems.entries()) {
    if (!isObject(entry)) return null;
    const itemId = safeString(entry.item_id);
    const role = entry.role as OutfitItemRole;
    if (!uuidPattern.test(itemId) || !roles.has(role) || itemIds.has(itemId)) return null;
    itemIds.add(itemId);
    items.push({
      item_id: itemId,
      role,
      sort_order:
        typeof entry.sort_order === "number" && Number.isInteger(entry.sort_order)
          ? entry.sort_order
          : index,
    });
  }
  return items.length ? items : null;
}
