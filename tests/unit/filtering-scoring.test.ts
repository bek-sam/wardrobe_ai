import { describe, expect, it } from "vitest";

import {
  createRecommendationWeights,
  DEFAULT_RECOMMENDATION_WEIGHTS,
  filterWardrobeCandidates,
  scoreWardrobeCandidate,
  weightedRecommendationScore,
} from "@/lib/recommendation";
import { deriveClothingConstraints } from "@/lib/weather";

import { ITEM_IDS, makeWardrobeItem } from "./fixtures";

describe("candidate filtering and scoring", () => {
  it("applies the documented 25/20/15/15/10/10/5 weights", () => {
    expect(DEFAULT_RECOMMENDATION_WEIGHTS).toEqual({
      weatherSuitability: 0.25,
      occasionFormality: 0.2,
      colorHarmony: 0.15,
      layeringSilhouette: 0.15,
      explicitPreference: 0.1,
      variety: 0.1,
      metadataConfidence: 0.05,
    });

    expect(
      weightedRecommendationScore({
        weatherSuitability: 1,
        occasionFormality: 0.5,
        colorHarmony: 0,
        layeringSilhouette: 0,
        explicitPreference: 0,
        variety: 0,
        metadataConfidence: 0,
      }),
    ).toBeCloseTo(0.35);
  });

  it("normalizes configurable weight overrides", () => {
    const weights = createRecommendationWeights({ weatherSuitability: 0.5 });
    const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    expect(total).toBeCloseTo(1);
    expect(weights.weatherSuitability).toBeGreaterThan(
      DEFAULT_RECOMMENDATION_WEIGHTS.weatherSuitability,
    );
    expect(() =>
      weightedRecommendationScore(
        {
          weatherSuitability: 1,
          occasionFormality: 1,
          colorHarmony: 1,
          layeringSilhouette: 1,
          explicitPreference: 1,
          variety: 1,
          metadataConfidence: 1,
        },
        { ...DEFAULT_RECOMMENDATION_WEIGHTS, weatherSuitability: 0.4 },
      ),
    ).toThrow(/add up to 1/i);
  });

  it("removes inactive, unavailable, dress-rule, and explicitly rain-unsafe items", () => {
    const weather = deriveClothingConstraints({
      temperatureC: 18,
      precipitationProbability: 80,
    });
    const items = [
      makeWardrobeItem(),
      makeWardrobeItem({ id: ITEM_IDS.topB, status: "archived" }),
      makeWardrobeItem({ id: ITEM_IDS.bottomA, availability_status: "laundry" }),
      makeWardrobeItem({
        id: ITEM_IDS.shoes,
        category: "shoes",
        layer_role: "shoes",
        weather_tags: ["rain-unsafe"],
      }),
      makeWardrobeItem({ id: ITEM_IDS.layer, formality_level: 1 }),
    ];

    const result = filterWardrobeCandidates(items, { weather, minimumFormality: 2 });
    expect(result.eligible.map((item) => item.id)).toEqual([ITEM_IDS.topA]);
    expect(result.excluded.map(({ reasons }) => reasons[0]?.code)).toEqual(
      expect.arrayContaining(["inactive", "unavailable", "weather", "dress_rule"]),
    );
  });

  it("encourages an under-worn candidate over an otherwise identical recent item", () => {
    const underWorn = makeWardrobeItem({ wear_count: 0 });
    const recent = makeWardrobeItem({ id: ITEM_IDS.topB, wear_count: 12 });
    const underWornScore = scoreWardrobeCandidate(underWorn).total;
    const recentScore = scoreWardrobeCandidate(recent, {
      recentlyWornItemIds: [recent.id],
    }).total;

    expect(underWornScore).toBeGreaterThan(recentScore);
  });
});
