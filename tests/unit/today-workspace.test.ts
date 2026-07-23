import { describe, expect, it } from "vitest";

import { normalizeTodayRecommendation } from "@/features/today/components/normalize-today-recommendation";

import { ITEM_IDS } from "./fixtures";

const baseOutfit = {
  title: "Rain-ready workday",
  explanation: "A light layer supports the cool, wet forecast.",
  warnings: ["Avoid suede in the rain."],
  confidence: 0.91,
  missing_category: null,
  follow_up_question: null,
  items: [
    { item_id: ITEM_IDS.topA, role: "top", sort_order: 0 },
    { item_id: ITEM_IDS.bottomA, role: "bottom", sort_order: 1 },
  ],
};

describe("Today recommendation normalization", () => {
  it("preserves exact owned-item selections, weather constraints, and a saved outfit ID", () => {
    const savedId = "70000000-0000-4000-8000-000000000001";
    const generationId = "70000000-0000-4000-8000-000000000002";
    const result = normalizeTodayRecommendation({
      generationId,
      outfit: baseOutfit,
      weather: {
        provider: "Open-Meteo",
        date: "2026-07-21",
        location: { name: "Chicago" },
        snapshot: {
          minimumTemperatureC: 14,
          maximumTemperatureC: 19,
          precipitationProbability: 65,
        },
        constraints: { temperatureBand: "cool", tags: ["needs_outer_layer", "rain_safe_shoes"] },
      },
      excludedItemCount: 3,
      savedOutfit: savedId,
    });

    expect(result).not.toBeNull();
    expect(result?.items).toEqual(baseOutfit.items);
    expect(result?.weather?.constraints).toEqual(["needs_outer_layer", "rain_safe_shoes"]);
    expect(result?.savedOutfitId).toBe(savedId);
    expect(result?.generationId).toBe(generationId);
    expect(result?.excludedItemCount).toBe(3);
  });

  it("rejects duplicate IDs, duplicate roles, and malformed selections", () => {
    expect(
      normalizeTodayRecommendation({
        outfit: {
          ...baseOutfit,
          items: [
            { item_id: ITEM_IDS.topA, role: "top" },
            { item_id: ITEM_IDS.topA, role: "bottom" },
          ],
        },
      }),
    ).toBeNull();

    expect(
      normalizeTodayRecommendation({
        outfit: {
          ...baseOutfit,
          items: [
            { item_id: ITEM_IDS.topA, role: "top" },
            { item_id: ITEM_IDS.bottomA, role: "top" },
          ],
        },
      }),
    ).toBeNull();

    expect(
      normalizeTodayRecommendation({
        outfit: { ...baseOutfit, items: [{ item_id: "not-a-uuid", role: "dress" }] },
      }),
    ).toBeNull();
  });
});
