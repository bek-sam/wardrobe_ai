import type { OutfitPlanProposal } from "@/features/outfits/types";
import type { WardrobeItem } from "@/features/wardrobe/types";
import {
  type CandidateScoringContext,
  outfitCombinationKey,
  scoreWardrobeCandidate,
} from "@/lib/recommendation";

import { average } from "./average";
import { buildCandidateMetadata } from "./build-candidate-metadata";
import type { ScoredItem } from "./score-foundation";
import type { CompilationBucket, GeneratedOutfitCandidate } from "./types";

export function buildGeneratedCandidate(
  variant: { selected: WardrobeItem[]; scored: ScoredItem[] },
  foundation: readonly WardrobeItem[],
  context: CandidateScoringContext,
  bucket: CompilationBucket,
): { proposal: OutfitPlanProposal; metadata: GeneratedOutfitCandidate } | null {
  const { selected, scored } = variant;
  const foundationScores = foundation.map((item) =>
    scoreWardrobeCandidate(item, {
      ...context,
      selectedItems: selected.filter((candidate) => candidate.id !== item.id),
    }),
  );
  const allScores = [...foundationScores, ...scored.map((entry) => entry.score)];
  if (allScores.length === 0) return null;

  const itemIds = selected.map((item) => item.id);
  const combinationKey = outfitCombinationKey(itemIds);

  return {
    proposal: {
      id: combinationKey,
      item_ids: itemIds,
      base_score: average(allScores.map((score) => score.total)),
    },
    metadata: buildCandidateMetadata(combinationKey, selected, allScores, bucket),
  };
}
