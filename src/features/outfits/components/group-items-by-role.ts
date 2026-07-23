import { resolveWardrobeItemRole } from "@/lib/recommendation/item-role";
import type { WardrobeItemRole } from "@/features/wardrobe/types";

import { roleOrder } from "./role-presentation.data";
import type { LiveWardrobeItem } from "./outfits-manager.types";

export function groupItemsByRole(
  items: LiveWardrobeItem[],
): Record<WardrobeItemRole, LiveWardrobeItem[]> {
  const groups: Record<WardrobeItemRole, LiveWardrobeItem[]> = {
    top: [],
    bottom: [],
    dress: [],
    layer: [],
    shoes: [],
    accessory: [],
  };
  for (const item of items) {
    const role = resolveWardrobeItemRole(item);
    if (role) groups[role].push(item);
  }
  for (const role of roleOrder) {
    groups[role].sort((first, second) => first.name.localeCompare(second.name));
  }
  return groups;
}
