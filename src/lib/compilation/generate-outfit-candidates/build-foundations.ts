import type { WardrobeItem, WardrobeItemRole } from "@/features/wardrobe/types";

export function buildFoundations(
  groups: Map<WardrobeItemRole, WardrobeItem[]>,
  maxFoundations: number,
) {
  const foundations: WardrobeItem[][] = [];
  for (const dress of groups.get("dress") ?? []) {
    foundations.push([dress]);
    if (foundations.length >= maxFoundations) return foundations;
  }
  for (const top of groups.get("top") ?? []) {
    for (const bottom of groups.get("bottom") ?? []) {
      foundations.push([top, bottom]);
      if (foundations.length >= maxFoundations) return foundations;
    }
  }
  return foundations;
}
