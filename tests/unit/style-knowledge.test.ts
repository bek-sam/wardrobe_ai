import { describe, expect, it } from "vitest";

import { classifyOutfitColorScheme } from "@/lib/style-knowledge/color-harmony";
import { evaluateFormalityConsistency } from "@/lib/style-knowledge/formality";
import { evaluateLayerCount } from "@/lib/style-knowledge/layering";
import { classifyMaterialFormality, evaluateMaterialMix } from "@/lib/style-knowledge/materials";
import { occasionStyleProfile } from "@/lib/style-knowledge/occasion-profiles";
import { classifyPatternScale, evaluatePatternMix } from "@/lib/style-knowledge/pattern-mixing";
import { evaluateLengthProportion } from "@/lib/style-knowledge/proportion";
import {
  classifySilhouetteWeight,
  evaluateSilhouetteBalance,
} from "@/lib/style-knowledge/silhouette-balance";
import { matchStyleArchetypes, STYLE_ARCHETYPES } from "@/lib/style-knowledge/style-archetypes";
import { evaluateWeatherAppropriateness } from "@/lib/style-knowledge/weather-dressing";

describe("color-harmony", () => {
  it("classifies a single-hue-family palette as monochrome", () => {
    expect(classifyOutfitColorScheme(["navy", "navy"]).scheme).toBe("monochrome");
  });

  it("classifies a neutral base plus one accent as neutral_with_accent", () => {
    expect(classifyOutfitColorScheme(["black", "red"]).scheme).toBe("neutral_with_accent");
  });

  it("classifies adjacent hues as analogous", () => {
    expect(classifyOutfitColorScheme(["yellow", "green"]).scheme).toBe("analogous");
  });

  it("classifies opposite hues with a neutral anchor as complementary", () => {
    expect(classifyOutfitColorScheme(["black", "blue", "orange"]).scheme).toBe("complementary");
  });

  it("classifies three or more competing hues with no neutral as clashing", () => {
    expect(classifyOutfitColorScheme(["red", "green", "blue"]).scheme).not.toBe(
      "neutral_with_accent",
    );
  });
});

describe("pattern-mixing", () => {
  it("treats solid as no pattern", () => {
    expect(classifyPatternScale("solid")).toBe("none");
    expect(classifyPatternScale(null)).toBe("none");
  });

  it("classifies animal print as bold", () => {
    expect(classifyPatternScale("leopard print")).toBe("bold");
  });

  it("is always compatible with at most one patterned piece", () => {
    expect(evaluatePatternMix(["solid", "plaid"]).compatible).toBe(true);
  });

  it("rejects two bold patterns", () => {
    expect(evaluatePatternMix(["leopard", "camo"]).compatible).toBe(false);
  });

  it("rejects three or more patterned pieces", () => {
    expect(evaluatePatternMix(["plaid", "floral", "stripe"]).compatible).toBe(false);
  });
});

describe("silhouette-balance", () => {
  it("classifies fitted/relaxed/oversized keywords", () => {
    expect(classifySilhouetteWeight("slim", null)).toBe("fitted");
    expect(classifySilhouetteWeight("relaxed", null)).toBe("relaxed");
    expect(classifySilhouetteWeight("oversized", null)).toBe("oversized");
    expect(classifySilhouetteWeight(null, null)).toBe("regular");
  });

  it("treats fitted+relaxed as balanced proportion play", () => {
    expect(evaluateSilhouetteBalance("fitted", "relaxed").balanced).toBe(true);
  });

  it("treats oversized+oversized as imbalanced", () => {
    expect(evaluateSilhouetteBalance("oversized", "oversized").balanced).toBe(false);
  });
});

describe("proportion", () => {
  it("treats a cropped top with a high-rise bottom as balanced", () => {
    const result = evaluateLengthProportion(
      { subcategory: "cropped tee", fit: null },
      { subcategory: null, fit: "high-rise" },
    );
    expect(result.balanced).toBe(true);
  });

  it("flags a long top over a wide-leg bottom", () => {
    const result = evaluateLengthProportion(
      { subcategory: "tunic", fit: null },
      { subcategory: null, fit: "wide-leg" },
    );
    expect(result.balanced).toBe(false);
  });
});

describe("layering", () => {
  it("expects zero layers on a hot day", () => {
    expect(evaluateLayerCount(0, "hot").appropriate).toBe(true);
    expect(evaluateLayerCount(2, "hot").appropriate).toBe(false);
  });

  it("expects two layers on a cold day", () => {
    expect(evaluateLayerCount(2, "cold").appropriate).toBe(true);
    expect(evaluateLayerCount(0, "cold").appropriate).toBe(false);
  });
});

describe("materials", () => {
  it("classifies denim as casual", () => {
    expect(classifyMaterialFormality(["denim"])).toBe("casual");
  });

  it("classifies silk as formal", () => {
    expect(classifyMaterialFormality(["silk"])).toBe("formal");
  });

  it("flags three or more casual/synthetic textures", () => {
    expect(evaluateMaterialMix([["denim"], ["fleece"], ["jersey"]]).harmonious).toBe(false);
  });
});

describe("formality", () => {
  it("is consistent when levels are within one point", () => {
    expect(evaluateFormalityConsistency([2, 3]).consistent).toBe(true);
  });

  it("is inconsistent across a wide spread", () => {
    expect(evaluateFormalityConsistency([1, 5]).consistent).toBe(false);
  });
});

describe("occasion-profiles", () => {
  it("has a profile for every occasion category", () => {
    expect(occasionStyleProfile("interview").formalityRange).toEqual([4, 5]);
    expect(occasionStyleProfile("casual").formalityRange).toEqual([1, 2]);
  });
});

describe("weather-dressing", () => {
  it("flags a warmth level far from a band's target as inappropriate", () => {
    expect(evaluateWeatherAppropriateness(1, "cold").appropriate).toBe(false);
    expect(evaluateWeatherAppropriateness(4, "cold").appropriate).toBe(true);
  });
});

describe("style-archetypes", () => {
  it("matches minimalist for a neutral, pattern-free outfit", () => {
    const matches = matchStyleArchetypes([
      { colorNames: ["black"], pattern: "solid", silhouette: "fitted", category: "tops" },
      { colorNames: ["white"], pattern: "solid", silhouette: "straight", category: "bottoms" },
    ]);
    expect(matches.some((entry) => entry.archetype === "minimalist")).toBe(true);
  });

  it("returns no matches for an empty item list", () => {
    expect(matchStyleArchetypes([])).toEqual([]);
  });

  it("exposes every archetype with a confidence between 0 and 1 when matched", () => {
    const matches = matchStyleArchetypes([
      {
        colorNames: ["black"],
        pattern: "leather panel",
        silhouette: "asymmetric",
        category: "jackets",
      },
    ]);
    for (const match of matches) {
      expect(STYLE_ARCHETYPES).toContain(match.archetype);
      expect(match.confidence).toBeGreaterThanOrEqual(0);
      expect(match.confidence).toBeLessThanOrEqual(1);
    }
  });
});
