import type { WardrobeItem } from "@/features/wardrobe/types";

import { resolveWardrobeItemRole } from "./item-role";
import { asCandidateMap } from "./planner-candidate-map";

export function outfitFoundationKey(
  itemIds: readonly string[],
  candidates: ReadonlyMap<string, WardrobeItem> | readonly WardrobeItem[],
) {
  const candidateMap = asCandidateMap(candidates);
  const topIds: string[] = [];
  const bottomIds: string[] = [];
  const dressIds: string[] = [];

  for (const itemId of itemIds) {
    const item = candidateMap.get(itemId);
    if (!item) continue;
    const role = resolveWardrobeItemRole(item);
    if (role === "top") topIds.push(itemId);
    if (role === "bottom") bottomIds.push(itemId);
    if (role === "dress") dressIds.push(itemId);
  }

  if (dressIds.length === 1 && topIds.length === 0 && bottomIds.length === 0) {
    return `dress:${dressIds[0]}`;
  }
  if (topIds.length !== 1 || bottomIds.length !== 1) return null;
  return `${topIds[0]}:${bottomIds[0]}`;
}
