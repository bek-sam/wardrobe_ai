import { describe, expect, it } from "vitest";

import { differsFromAll, isMeaningfullyDifferent, outfitOverlapRatio } from "@/lib/recommendation";
import { keepLockedCandidates } from "@/lib/ai/agents/orchestrator/variants/keep-locked";
import type { RetrievedOutfitCandidate } from "@/lib/ai/agents/retrieve-outfit-candidate";

describe("outfitOverlapRatio", () => {
  it("is 1 for identical sets and 0 for disjoint ones", () => {
    expect(outfitOverlapRatio(["a", "b"], ["a", "b"])).toBe(1);
    expect(outfitOverlapRatio(["a", "b"], ["c", "d"])).toBe(0);
  });

  it("measures against the larger set so a subset is not called identical", () => {
    expect(outfitOverlapRatio(["a"], ["a", "b", "c", "d"])).toBe(0.25);
  });
});

describe("meaningful difference", () => {
  it("accepts two looks built on different foundations", () => {
    expect(
      isMeaningfullyDifferent(
        { itemIds: ["top1", "bot1", "shoe"], foundationKey: "top1:bot1" },
        { itemIds: ["top2", "bot2", "shoe"], foundationKey: "top2:bot2" },
      ),
    ).toBe(true);
  });

  it("rejects a look that only swapped an accessory", () => {
    expect(
      isMeaningfullyDifferent(
        { itemIds: ["top1", "bot1", "shoe", "scarf-a"], foundationKey: "top1:bot1" },
        { itemIds: ["top1", "bot1", "shoe", "scarf-b"], foundationKey: "top1:bot1" },
      ),
    ).toBe(false);
  });

  it("accepts a shared foundation when half the look changes", () => {
    // Same top and bottom, but different shoes *and* different outer layer:
    // that reads as a real alternative rather than a relabelled duplicate.
    expect(
      isMeaningfullyDifferent(
        { itemIds: ["top1", "bot1", "shoeA", "coatA"], foundationKey: "top1:bot1" },
        { itemIds: ["top1", "bot1", "shoeB", "coatB"], foundationKey: "top1:bot1" },
      ),
    ).toBe(true);
  });

  it("rejects a shared foundation when only one minor piece changes", () => {
    expect(
      isMeaningfullyDifferent(
        { itemIds: ["top1", "bot1", "shoeA", "coatA"], foundationKey: "top1:bot1" },
        { itemIds: ["top1", "bot1", "shoeA", "coatB"], foundationKey: "top1:bot1" },
      ),
    ).toBe(false);
  });

  it("requires difference from every already-chosen look, not just the last", () => {
    const chosen = [
      { itemIds: ["a", "b", "c"], foundationKey: "a:b" },
      { itemIds: ["d", "e", "f"], foundationKey: "d:e" },
    ];
    expect(differsFromAll({ itemIds: ["a", "b", "z"], foundationKey: "a:b" }, chosen)).toBe(false);
    expect(differsFromAll({ itemIds: ["x", "y", "z"], foundationKey: "x:y" }, chosen)).toBe(true);
  });
});

function candidate(id: string, itemIds: string[]): RetrievedOutfitCandidate {
  return {
    candidateId: id,
    score: 0.8,
    selectionReason: "safest",
    items: itemIds.map((itemId, index) => ({
      item_id: itemId,
      role: "top" as const,
      sort_order: index,
    })),
    resolvedItems: [],
    styleTags: [],
    previewStatus: "none",
  };
}

describe("lock invariant", () => {
  it("passes every candidate through when nothing is locked", () => {
    const candidates = [candidate("a", ["1", "2"]), candidate("b", ["3", "4"])];
    expect(keepLockedCandidates(candidates, [])).toHaveLength(2);
  });

  it("drops any candidate missing a locked item", () => {
    const candidates = [candidate("a", ["1", "2"]), candidate("b", ["3", "4"])];
    const kept = keepLockedCandidates(candidates, ["1"]);
    expect(kept.map((entry) => entry.candidateId)).toEqual(["a"]);
  });

  it("requires every locked item, not just one of them", () => {
    const candidates = [candidate("a", ["1", "2"]), candidate("b", ["1", "9"])];
    const kept = keepLockedCandidates(candidates, ["1", "2"]);
    expect(kept.map((entry) => entry.candidateId)).toEqual(["a"]);
  });

  it("returns nothing rather than a look that breaks a lock", () => {
    expect(keepLockedCandidates([candidate("a", ["1", "2"])], ["7"])).toEqual([]);
  });
});
