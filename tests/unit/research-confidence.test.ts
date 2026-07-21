import { describe, expect, it } from "vitest";

import { mapResearchConfidence } from "@/lib/recommendation";

describe("research confidence mapping", () => {
  it("verifies only an exact identifier supported by an official source", () => {
    expect(
      mapResearchConfidence({
        confidence: 0.84,
        sourceTypes: ["official_brand"],
        exactIdentifierMatch: true,
      }),
    ).toMatchObject({ status: "verified", confidence: 0.9 });
  });

  it("marks strong retailer evidence with confirmed clues as likely", () => {
    expect(
      mapResearchConfidence({
        confidence: 0.79,
        sourceTypes: ["retailer"],
        userConfirmedBrand: true,
        matchingTextClues: 2,
      }).status,
    ).toBe("likely");
  });

  it("never treats visual similarity alone as proof", () => {
    const result = mapResearchConfidence({
      confidence: 0.98,
      sourceTypes: ["official_brand", "retailer"],
      visualSimilarityOnly: true,
    });

    expect(result.status).toBe("uncertain");
    expect(result.confidence).toBeLessThan(0.5);
  });

  it("returns not_found when no supporting source exists", () => {
    expect(mapResearchConfidence({ confidence: 0.4, sourceTypes: [] }).status).toBe("not_found");
  });

  it("sanitizes non-finite confidence input", () => {
    expect(
      mapResearchConfidence({ confidence: Number.NaN, sourceTypes: ["other"] }).confidence,
    ).toBe(0);
  });
});
