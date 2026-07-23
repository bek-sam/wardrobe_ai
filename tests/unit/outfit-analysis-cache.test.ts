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
  });

  it("produces a 64-character hex sha256 digest", () => {
    expect(computeAnalysisHash(baseInput())).toMatch(/^[0-9a-f]{64}$/);
  });
});
