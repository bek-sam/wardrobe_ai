import type { WardrobeItem } from "@/features/wardrobe/types";

import { resolveWardrobeItemRole } from "./item-role";
import { asCandidateMap } from "./planner-candidate-map";

export function hasCompleteOutfitStructure(
  itemIds: readonly string[],
  candidates: ReadonlyMap<string, WardrobeItem> | readonly WardrobeItem[],
) {
  if (itemIds.length < 1 || itemIds.length > 5 || new Set(itemIds).size !== itemIds.length) {
    return false;
  }

  const candidateMap = asCandidateMap(candidates);
  const roleCounts = new Map<string, number>();
  for (const itemId of itemIds) {
    const item = candidateMap.get(itemId);
    if (!item) return false;
    const role = resolveWardrobeItemRole(item);
    if (!role) return false;
    roleCounts.set(role, (roleCounts.get(role) ?? 0) + 1);
  }

  const dressCount = roleCounts.get("dress") ?? 0;
  const topCount = roleCounts.get("top") ?? 0;
  const bottomCount = roleCounts.get("bottom") ?? 0;
  const hasOnePieceFoundation = dressCount === 1 && topCount === 0 && bottomCount === 0;
  const hasTwoPieceFoundation = dressCount === 0 && topCount === 1 && bottomCount === 1;
  if (!hasOnePieceFoundation && !hasTwoPieceFoundation) return false;
  return ["layer", "shoes", "accessory"].every((role) => (roleCounts.get(role) ?? 0) <= 1);
}
