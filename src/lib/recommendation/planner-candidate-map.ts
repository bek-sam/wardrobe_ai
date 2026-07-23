import type { WardrobeItem } from "@/features/wardrobe/types";

function isCandidateArray(
  candidates: ReadonlyMap<string, WardrobeItem> | readonly WardrobeItem[],
): candidates is readonly WardrobeItem[] {
  return Array.isArray(candidates);
}

export function asCandidateMap(
  candidates: ReadonlyMap<string, WardrobeItem> | readonly WardrobeItem[],
): ReadonlyMap<string, WardrobeItem> {
  return isCandidateArray(candidates)
    ? new Map(candidates.map((item) => [item.id, item]))
    : candidates;
}
