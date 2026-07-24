import type { WardrobeItem } from "@/features/wardrobe/types";
import { resolveWardrobeItemRole } from "@/lib/recommendation";

import type { GeneratedOutfitCandidateItem } from "./types";

export function buildRoleAssignments(
  selected: readonly WardrobeItem[],
): GeneratedOutfitCandidateItem[] {
  return selected.map((item, index) => {
    const role = resolveWardrobeItemRole(item);
    if (!role) throw new Error("A scored outfit candidate item has no resolvable role.");
    return { itemId: item.id, role, sortOrder: index };
  });
}
