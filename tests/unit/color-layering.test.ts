import { describe, expect, it } from "vitest";

import {
  analyzeColorPair,
  analyzeLayering,
  scoreSilhouetteCompatibility,
} from "@/lib/recommendation";

import { ITEM_IDS, makeWardrobeItem } from "./fixtures";

describe("color and silhouette compatibility", () => {
  it("treats a neutral as a controlled partner for a saturated color", () => {
    expect(analyzeColorPair("black", "#dc2626")).toMatchObject({
      relation: "neutral",
      score: 0.92,
    });
  });

  it("recognizes tonal and complementary hue relationships", () => {
    expect(analyzeColorPair("#dc2626", "#c0262d").relation).toBe("tonal");
    expect(analyzeColorPair("#dc2626", "#16a34a").relation).toBe("complementary");
  });

  it("favors one full silhouette balanced by one fitted silhouette", () => {
    expect(
      scoreSilhouetteCompatibility(
        { silhouette: "oversized", fit: null },
        { silhouette: "wide leg", fit: null },
      ),
    ).toBeLessThan(0.5);
    expect(
      scoreSilhouetteCompatibility(
        { silhouette: "fitted", fit: null },
        { silhouette: "wide leg", fit: null },
      ),
    ).toBeGreaterThan(0.9);
  });

  it("flags physically awkward layering and competing statements", () => {
    const top = makeWardrobeItem({ pattern: "graphic", silhouette: "oversized" });
    const bottom = makeWardrobeItem({
      id: ITEM_IDS.bottomA,
      name: "Trousers",
      category: "bottoms",
      layer_role: "bottom",
      silhouette: "straight",
    });
    const layer = makeWardrobeItem({
      id: ITEM_IDS.layer,
      name: "Patterned fitted coat",
      category: "outerwear",
      layer_role: "layer",
      pattern: "plaid",
      fit: "fitted",
      warmth_level: 5,
    });

    const result = analyzeLayering([top, bottom, layer]);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/may not sit naturally/i),
        expect.stringMatching(/competes|compete/i),
      ]),
    );
    expect(result.score).toBeLessThan(0.7);
  });
});
