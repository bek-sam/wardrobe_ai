import type { WardrobeItem } from "@/features/wardrobe/types";
import { resolveWardrobeItemRole } from "@/lib/recommendation/item-role";

export function resolveOutfitItemRoles(
  itemIds: readonly string[],
  candidates: readonly WardrobeItem[],
) {
  return itemIds.map((itemId, index) => {
    const item = candidates.find((candidate) => candidate.id === itemId);
    if (!item) throw new Error("The model selected an item outside the candidate set.");
    const role = resolveWardrobeItemRole(item);
    if (!role) throw new Error("The selected item has no valid outfit role.");
    return { item_id: itemId, role, sort_order: index };
  });
}
