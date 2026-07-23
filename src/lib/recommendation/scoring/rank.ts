import type { WardrobeItem } from "@/features/wardrobe/types";

import { scoreColorHarmony } from "../color-compatibility";
import { analyzeLayering } from "../layering";
import {
  DEFAULT_RECOMMENDATION_WEIGHTS,
  type RecommendationScoreComponents,
  type RecommendationWeights,
  weightedRecommendationScore,
} from "../weights";
import { scoreOccasion } from "./score-occasion";
import { scorePreference } from "./score-preference";
import { scoreVariety } from "./score-variety";
import { scoreWeather } from "./score-weather";
import type { CandidateScore, CandidateScoringContext } from "./types";

export function scoreWardrobeCandidate(
  item: WardrobeItem,
  context: CandidateScoringContext = {},
  weights: RecommendationWeights = DEFAULT_RECOMMENDATION_WEIGHTS,
): CandidateScore {
  const selectedItems = context.selectedItems ?? [];
  const components: RecommendationScoreComponents = {
    weatherSuitability: scoreWeather(item, context.weather),
    occasionFormality: scoreOccasion(item, context),
    colorHarmony: scoreColorHarmony([...selectedItems, item]),
    layeringSilhouette: analyzeLayering([...selectedItems, item]).score,
    explicitPreference: scorePreference(item, context.preferences),
    variety: scoreVariety(item, context.recentlyWornItemIds),
    metadataConfidence: item.metadata_confidence ?? 0.5,
  };

  return {
    itemId: item.id,
    total: weightedRecommendationScore(components, weights),
    components,
  };
}

export function rankWardrobeCandidates(
  items: readonly WardrobeItem[],
  context: CandidateScoringContext = {},
  weights: RecommendationWeights = DEFAULT_RECOMMENDATION_WEIGHTS,
) {
  return items
    .map((item) => scoreWardrobeCandidate(item, context, weights))
    .sort(
      (first, second) => second.total - first.total || first.itemId.localeCompare(second.itemId),
    );
}
