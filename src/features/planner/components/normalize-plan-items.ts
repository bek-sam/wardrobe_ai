import { isObject, safeColor, safeString } from "@/lib/api/normalize";
import type { OutfitItemRole } from "@/features/outfits/types";

import { relationObject } from "./relation-object";
import { roles, uuidPattern } from "./planner-constants.data";
import type { PlanItem } from "./planner.types";

export function normalizePlanItems(outfit: Record<string, unknown> | null): PlanItem[] {
  const rawItems = outfit && Array.isArray(outfit.outfit_items) ? outfit.outfit_items : [];
  const items: PlanItem[] = [];
  for (const entry of rawItems) {
    if (!isObject(entry)) continue;
    const wardrobeItem = relationObject(entry.wardrobe_items);
    const itemId = safeString(entry.item_id);
    const role = entry.role as OutfitItemRole;
    if (!uuidPattern.test(itemId) || !roles.has(role)) continue;
    items.push({
      id: itemId,
      name: wardrobeItem ? safeString(wardrobeItem.name, "Owned item") : "Owned item",
      role,
      primaryColor: wardrobeItem ? safeColor(wardrobeItem.primary_color_hex) : null,
      secondaryColor: wardrobeItem ? safeColor(wardrobeItem.secondary_color_hex) : null,
    });
  }
  return items;
}
