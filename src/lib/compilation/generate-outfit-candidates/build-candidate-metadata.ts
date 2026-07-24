import type { WardrobeItem } from "@/features/wardrobe/types";
import type { CandidateScore } from "@/lib/recommendation";

import { average } from "./average";
import { buildRoleAssignments } from "./build-role-assignments";
import type { CompilationBucket, GeneratedOutfitCandidate } from "./types";
import { weatherTagsForOutfit } from "./weather-tags";

export function buildCandidateMetadata(
  combinationKey: string,
  selected: readonly WardrobeItem[],
  allScores: readonly CandidateScore[],
  bucket: CompilationBucket,
): GeneratedOutfitCandidate {
  const formalityLevels = selected
    .map((item) => item.formality_level)
    .filter((value): value is number => value !== null);
  const warmthLevels = selected
    .map((item) => item.warmth_level)
    .filter((value): value is number => value !== null);

  return {
    combinationKey,
    items: buildRoleAssignments(selected),
    totalScore: average(allScores.map((score) => score.total)),
    colorHarmony: average(allScores.map((score) => score.components.colorHarmony)),
    layeringQuality: average(allScores.map((score) => score.components.layeringSilhouette)),
    occasionFormality: average(allScores.map((score) => score.components.occasionFormality)),
    preferenceMatch: average(allScores.map((score) => score.components.explicitPreference)),
    variety: average(allScores.map((score) => score.components.variety)),
    occasionTags: [...bucket.occasionTags],
    occasionCategory: bucket.key,
    weatherTags: weatherTagsForOutfit(selected),
    formalityLevel: formalityLevels.length ? Math.round(average(formalityLevels)) : null,
    warmthLevel: warmthLevels.length ? Math.round(average(warmthLevels)) : null,
    bucketKey: bucket.key,
  };
}
