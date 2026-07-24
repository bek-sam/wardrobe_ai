import type { WardrobeItem } from "@/features/wardrobe/types";
import {
  type CandidateScore,
  type CandidateScoringContext,
  scoreWardrobeCandidate,
} from "@/lib/recommendation";

import { average } from "./average";

export type ScoredItem = { item: WardrobeItem; score: CandidateScore };

export function quickFoundationScore(
  foundation: readonly WardrobeItem[],
  context: CandidateScoringContext,
) {
  return average(
    foundation.map(
      (item) =>
        scoreWardrobeCandidate(item, {
          ...context,
          selectedItems: foundation.filter((candidate) => candidate.id !== item.id),
        }).total,
    ),
  );
}

export function topScoredItems(
  pool: readonly WardrobeItem[],
  selected: readonly WardrobeItem[],
  context: CandidateScoringContext,
  limit: number,
): ScoredItem[] {
  return pool
    .map((item) => ({
      item,
      score: scoreWardrobeCandidate(item, { ...context, selectedItems: selected }),
    }))
    .sort((first, second) => second.score.total - first.score.total)
    .slice(0, limit);
}
