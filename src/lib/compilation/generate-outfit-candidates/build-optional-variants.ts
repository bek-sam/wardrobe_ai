import type { WardrobeItem, WardrobeItemRole } from "@/features/wardrobe/types";
import type { CandidateScoringContext } from "@/lib/recommendation";

import {
  MAX_ACCESSORY_VARIANTS,
  MAX_SHOE_VARIANTS,
  OPTIONAL_ROLE_SCORE_THRESHOLD,
} from "./constants.data";
import { type ScoredItem, topScoredItems } from "./score-foundation";

/**
 * Bounded per-foundation fan-out: up to 2 layer states (with the best-fitting
 * layer, and without) x up to 2 shoe options x up to 3 accessory states (none,
 * plus up to 2 good-fit accessories) = at most 12 small, deterministic
 * variants per foundation+bucket. This is a fixed constant factor per
 * foundation, not an unbounded Cartesian product over the whole wardrobe.
 */
export function buildOptionalRoleVariants(
  foundation: readonly WardrobeItem[],
  groups: Map<WardrobeItemRole, WardrobeItem[]>,
  context: CandidateScoringContext,
): { selected: WardrobeItem[]; scored: ScoredItem[] }[] {
  const shoeOptions = topScoredItems(
    groups.get("shoes") ?? [],
    foundation,
    context,
    MAX_SHOE_VARIANTS,
  );
  // Shoes complete almost every outfit, so only fall back to "no shoes" when
  // none are owned at all; layers/accessories default to "not included".
  const shoeVariants: (ScoredItem | null)[] = shoeOptions.length > 0 ? shoeOptions : [null];

  const bestLayer = topScoredItems(groups.get("layer") ?? [], foundation, context, 1)[0];
  const layerVariants: (ScoredItem | null)[] =
    bestLayer && bestLayer.score.total >= OPTIONAL_ROLE_SCORE_THRESHOLD
      ? [bestLayer, null]
      : [null];

  const accessoryOptions = topScoredItems(
    groups.get("accessory") ?? [],
    foundation,
    context,
    MAX_ACCESSORY_VARIANTS,
  ).filter((entry) => entry.score.total >= OPTIONAL_ROLE_SCORE_THRESHOLD);
  const accessoryVariants: (ScoredItem | null)[] = [null, ...accessoryOptions];

  const results: { selected: WardrobeItem[]; scored: ScoredItem[] }[] = [];
  for (const layer of layerVariants) {
    for (const shoes of shoeVariants) {
      for (const accessory of accessoryVariants) {
        const scored = [layer, shoes, accessory].filter(
          (entry): entry is ScoredItem => entry !== null,
        );
        results.push({ selected: [...foundation, ...scored.map((entry) => entry.item)], scored });
      }
    }
  }
  return results;
}
