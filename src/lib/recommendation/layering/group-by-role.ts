import type { WardrobeItem } from "@/features/wardrobe/types";

import { resolveWardrobeItemRole } from "../item-role";

export function groupItemsByRole(items: readonly WardrobeItem[]): {
  byRole: Map<string, WardrobeItem[]>;
  issues: string[];
} {
  const issues: string[] = [];
  const byRole = new Map<string, WardrobeItem[]>();

  for (const item of items) {
    const role = resolveWardrobeItemRole(item);
    if (!role) {
      issues.push(`Could not determine the outfit role for ${item.id}.`);
      continue;
    }
    const group = byRole.get(role) ?? [];
    group.push(item);
    byRole.set(role, group);
  }

  return { byRole, issues };
}
