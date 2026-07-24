import type { WardrobeItem, WardrobeItemRole } from "@/features/wardrobe/types";
import { resolveWardrobeItemRole } from "@/lib/recommendation";

export function groupByRole(items: readonly WardrobeItem[]) {
  const groups = new Map<WardrobeItemRole, WardrobeItem[]>();
  for (const item of items) {
    const role = resolveWardrobeItemRole(item);
    if (!role) continue;
    const group = groups.get(role) ?? [];
    group.push(item);
    groups.set(role, group);
  }
  return groups;
}
