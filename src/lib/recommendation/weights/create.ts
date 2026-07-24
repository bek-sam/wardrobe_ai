import {
  DEFAULT_RECOMMENDATION_WEIGHTS,
  RECOMMENDATION_SCORE_KEYS,
  type RecommendationScoreKey,
  type RecommendationWeights,
} from "./constants.data";

export function createRecommendationWeights(
  overrides: Partial<Record<RecommendationScoreKey, number>> = {},
): RecommendationWeights {
  const merged = { ...DEFAULT_RECOMMENDATION_WEIGHTS, ...overrides };
  const values = RECOMMENDATION_SCORE_KEYS.map((key) => merged[key]);
  if (values.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error("Recommendation weights must be finite, non-negative numbers.");
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) throw new Error("At least one recommendation weight must be positive.");

  return Object.freeze(
    Object.fromEntries(
      RECOMMENDATION_SCORE_KEYS.map((key) => [key, merged[key] / total]),
    ) as unknown as Record<RecommendationScoreKey, number>,
  );
}
