import { resolveWardrobeItemRole } from "@/lib/recommendation/item-role";

import type { OutfitSelection, OwnedItem, Recommendation } from "./stylist.types";

export function isRecommendationStillEligible(
  items: OutfitSelection[],
  itemDetails: Map<string, OwnedItem>,
): boolean {
  if (itemDetails.size !== items.length) return false;
  return items.every((selection) => {
    const item = itemDetails.get(selection.item_id);
    return (
      item &&
      resolveWardrobeItemRole({
        layer_role: item.layerRole,
        category: item.category,
        subcategory: item.subcategory,
      }) === selection.role
    );
  });
}

export function buildEligibleRecommendation(
  normalized: Omit<Recommendation, "itemDetails">,
  itemDetails: Map<string, OwnedItem>,
): Recommendation {
  return { ...normalized, itemDetails };
}
