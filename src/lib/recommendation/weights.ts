export const RECOMMENDATION_SCORE_KEYS = [
  "weatherSuitability",
  "occasionFormality",
  "colorHarmony",
  "layeringSilhouette",
  "explicitPreference",
  "variety",
  "metadataConfidence",
] as const;

export type RecommendationScoreKey = (typeof RECOMMENDATION_SCORE_KEYS)[number];
export type RecommendationWeights = Readonly<Record<RecommendationScoreKey, number>>;
export type RecommendationScoreComponents = Readonly<Record<RecommendationScoreKey, number>>;

export const DEFAULT_RECOMMENDATION_WEIGHTS: RecommendationWeights = Object.freeze({
  weatherSuitability: 0.25,
  occasionFormality: 0.2,
  colorHarmony: 0.15,
  layeringSilhouette: 0.15,
  explicitPreference: 0.1,
  variety: 0.1,
  metadataConfidence: 0.05,
});

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

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
