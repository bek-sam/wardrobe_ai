import type { WardrobeItem } from "@/features/wardrobe/types";

import { asSet, clamp01 } from "./normalize";
import type { CandidateScoringContext } from "./types";

export function scoreVariety(
  item: WardrobeItem,
  recentlyWornItemIds: CandidateScoringContext["recentlyWornItemIds"],
) {
  if (asSet(recentlyWornItemIds).has(item.id)) return 0.2;
  return clamp01(Math.max(0.35, 0.95 - Math.min(item.wear_count, 30) / 40));
}
