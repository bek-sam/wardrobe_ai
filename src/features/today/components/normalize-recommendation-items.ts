import { isObject, safeString } from "@/lib/api/normalize";
import type { OutfitItemRole } from "@/features/outfits/types";

import { outfitRoles, uuidPattern } from "./today-constants.data";
import type { OutfitSelection } from "./today.types";

export function normalizeRecommendationItems(rawItems: unknown[]): OutfitSelection[] | null {
  const items: OutfitSelection[] = [];
  const seenIds = new Set<string>();
  const seenRoles = new Set<OutfitItemRole>();
  for (const [index, rawItem] of rawItems.entries()) {
    if (!isObject(rawItem)) return null;
    const itemId = safeString(rawItem.item_id);
    const role = rawItem.role as OutfitItemRole;
    if (
      !uuidPattern.test(itemId) ||
      !outfitRoles.has(role) ||
      seenIds.has(itemId) ||
      seenRoles.has(role)
    ) {
      return null;
    }
    seenIds.add(itemId);
    seenRoles.add(role);
    items.push({
      item_id: itemId,
      role,
      sort_order:
        typeof rawItem.sort_order === "number" && Number.isInteger(rawItem.sort_order)
          ? rawItem.sort_order
          : index,
    });
  }
  return items.length ? items : null;
}
