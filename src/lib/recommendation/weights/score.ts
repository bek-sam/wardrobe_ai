import {
  DEFAULT_RECOMMENDATION_WEIGHTS,
  RECOMMENDATION_SCORE_KEYS,
  type RecommendationScoreComponents,
  type RecommendationWeights,
} from "./constants.data";
import { assertRecommendationWeights } from "./assert";

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function weightedRecommendationScore(
  components: RecommendationScoreComponents,
  weights: RecommendationWeights = DEFAULT_RECOMMENDATION_WEIGHTS,
) {
  assertRecommendationWeights(weights);
  return RECOMMENDATION_SCORE_KEYS.reduce(
    (total, key) => total + clamp01(components[key]) * weights[key],
    0,
  );
}
