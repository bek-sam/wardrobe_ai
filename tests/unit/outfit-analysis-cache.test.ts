import { describe, expect, it } from "vitest";

import { computeAnalysisHash } from "@/lib/ai/agents/outfit-analysis-cache";

function baseInput() {
  return {
    itemIds: ["item-a", "item-b"],
    itemMetadataVersions: {
      "item-a": "2026-07-20T00:00:00.000Z",
      "item-b": "2026-07-21T00:00:00.000Z",
    },
    preferenceVersion: "2026-07-19T00:00:00.000Z",
    styleKnowledgeVersion: "2026-07-22.1",
    curatorModel: "test-model",
    curatorPromptVersion: "v1",
    occasionCategory: "business" as string | null,
    totalScore: 0.8,
    formalityLevel: 3 as number | null,
    warmthLevel: 2 as number | null,
    colorHarmony: 0.7 as number | null,
    layeringQuality: 0.6 as number | null,
    occasionFormality: 0.75 as number | null,
    preferenceMatch: 0.5 as number | null,
    variety: 0.4 as number | null,
  };
}

describe("computeAnalysisHash", () => {
  it("is deterministic for identical input", () => {
    expect(computeAnalysisHash(baseInput())).toBe(computeAnalysisHash(baseInput()));
  });

  it("is independent of itemIds array order", () => {
    const reordered = { ...baseInput(), itemIds: ["item-b", "item-a"] };
    expect(computeAnalysisHash(reordered)).toBe(computeAnalysisHash(baseInput()));
  });

  it("is independent of itemMetadataVersions key order", () => {
    const reordered = {
      ...baseInput(),
      itemMetadataVersions: {
        "item-b": "2026-07-21T00:00:00.000Z",
        "item-a": "2026-07-20T00:00:00.000Z",
      },
    };
    expect(computeAnalysisHash(reordered)).toBe(computeAnalysisHash(baseInput()));
  });

  it("changes when any single field changes", () => {
    const base = computeAnalysisHash(baseInput());
    expect(computeAnalysisHash({ ...baseInput(), preferenceVersion: "changed" })).not.toBe(base);
    expect(computeAnalysisHash({ ...baseInput(), styleKnowledgeVersion: "changed" })).not.toBe(
      base,
    );
    expect(computeAnalysisHash({ ...baseInput(), curatorModel: "changed" })).not.toBe(base);
    expect(computeAnalysisHash({ ...baseInput(), curatorPromptVersion: "changed" })).not.toBe(base);
    expect(
      computeAnalysisHash({
        ...baseInput(),
        itemMetadataVersions: { ...baseInput().itemMetadataVersions, "item-a": "changed" },
      }),
    ).not.toBe(base);
    expect(computeAnalysisHash({ ...baseInput(), occasionCategory: "casual" })).not.toBe(base);
    expect(computeAnalysisHash({ ...baseInput(), totalScore: 0.1 })).not.toBe(base);
    expect(computeAnalysisHash({ ...baseInput(), formalityLevel: 5 })).not.toBe(base);
    expect(computeAnalysisHash({ ...baseInput(), warmthLevel: 5 })).not.toBe(base);
    expect(computeAnalysisHash({ ...baseInput(), colorHarmony: 0.1 })).not.toBe(base);
    expect(computeAnalysisHash({ ...baseInput(), layeringQuality: 0.1 })).not.toBe(base);
    expect(computeAnalysisHash({ ...baseInput(), occasionFormality: 0.1 })).not.toBe(base);
    expect(computeAnalysisHash({ ...baseInput(), preferenceMatch: 0.1 })).not.toBe(base);
    expect(computeAnalysisHash({ ...baseInput(), variety: 0.1 })).not.toBe(base);
  });

  it("produces a 64-character hex sha256 digest", () => {
    expect(computeAnalysisHash(baseInput())).toMatch(/^[0-9a-f]{64}$/);
  });
});
