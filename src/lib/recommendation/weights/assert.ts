import { RECOMMENDATION_SCORE_KEYS } from "./constants.data";
import type { RecommendationWeights } from "./constants.data";

export function assertRecommendationWeights(
  weights: RecommendationWeights,
): asserts weights is RecommendationWeights {
  const values = RECOMMENDATION_SCORE_KEYS.map((key) => weights[key]);
  if (values.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error("Recommendation weights must be finite, non-negative numbers.");
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  if (Math.abs(total - 1) > 1e-9) {
    throw new Error("Recommendation weights must add up to 1.");
  }
}
