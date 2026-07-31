import type { WardrobeItem, WardrobeItemRole } from "@/features/wardrobe/types";

import { interleaveSeparates } from "./interleave-separates";

/**
 * Builds the foundation set the candidate library is generated from.
 *
 * Deliberately not "take the first N in insertion order", which is what this
 * replaces: that emitted every dress before any separates, so a wardrobe with
 * enough dresses produced a library containing no top-and-bottom looks at all,
 * and the nested top×bottom loop paired only the first few tops with anything.
 * Either way the three variants had nothing genuinely different to choose
 * between.
 *
 * Instead the budget is split between the two foundation families by what each
 * can actually supply, and within separates the pairs are interleaved so every
 * top and every bottom appears before any garment repeats.
 */
export function buildFoundations(
  groups: Map<WardrobeItemRole, WardrobeItem[]>,
  maxFoundations: number,
) {
  if (maxFoundations <= 0) return [];

  const dresses = groups.get("dress") ?? [];
  const tops = groups.get("top") ?? [];
  const bottoms = groups.get("bottom") ?? [];
  const separatesAvailable = tops.length * bottoms.length;

  const dressShare = Math.min(
    dresses.length,
    separatesAvailable === 0 ? maxFoundations : Math.ceil(maxFoundations / 2),
  );
  const foundations: WardrobeItem[][] = dresses.slice(0, dressShare).map((dress) => [dress]);

  const separatesShare = Math.min(separatesAvailable, maxFoundations - foundations.length);
  foundations.push(...interleaveSeparates(tops, bottoms, separatesShare));

  // Budget the smaller family could not use goes back to the other one.
  for (const dress of dresses.slice(dressShare)) {
    if (foundations.length >= maxFoundations) break;
    foundations.push([dress]);
  }
  return foundations.slice(0, maxFoundations);
}
