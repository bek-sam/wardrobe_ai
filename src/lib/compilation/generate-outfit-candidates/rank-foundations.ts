import type { WardrobeItem } from "@/features/wardrobe/types";
import type { CandidateScoringContext } from "@/lib/recommendation";

import { quickFoundationScore } from "./score-foundation";

export function rankFoundations(
  foundations: readonly WardrobeItem[][],
  context: CandidateScoringContext,
  limit: number,
): WardrobeItem[][] {
  return foundations
    .map((foundation) => ({ foundation, score: quickFoundationScore(foundation, context) }))
    .sort((first, second) => second.score - first.score)
    .slice(0, limit)
    .map((entry) => entry.foundation);
}
