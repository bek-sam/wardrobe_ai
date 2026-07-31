import type { WardrobeItem } from "@/features/wardrobe/types";

/**
 * Top/bottom pairs ordered so every top and every bottom is used once before
 * any single garment is reused.
 *
 * The nested loop this replaces walked tops in the outer position, so a
 * truncated budget paired the first top with every bottom and left every other
 * top unrepresented. Walking the diagonals instead means a budget of N covers
 * min(N, tops, bottoms) distinct tops *and* distinct bottoms, which is what
 * gives the Safe/Fresh/Statement selection genuinely different material.
 */
export function interleaveSeparates(
  tops: readonly WardrobeItem[],
  bottoms: readonly WardrobeItem[],
  limit: number,
): WardrobeItem[][] {
  if (limit <= 0 || tops.length === 0 || bottoms.length === 0) return [];

  const pairs: WardrobeItem[][] = [];
  for (let offset = 0; offset < bottoms.length && pairs.length < limit; offset += 1) {
    for (let index = 0; index < tops.length && pairs.length < limit; index += 1) {
      const top = tops[index];
      const bottom = bottoms[(index + offset) % bottoms.length];
      if (top && bottom) pairs.push([top, bottom]);
    }
  }
  return pairs;
}
