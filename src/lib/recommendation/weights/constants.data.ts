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
