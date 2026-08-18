import { describe, expect, it } from "vitest";

import { applySwap } from "@/features/studio/hooks";
import type { SwapCandidate } from "@/features/studio/api";
import type { StudioVariant, StudioVariantsResponse } from "@/features/studio/types";

function item(itemId: string, role: StudioVariant["items"][number]["role"], sortOrder: number) {
  return {
    itemId,
    role,
    sortOrder,
    name: `${role} ${itemId}`,
    category: "tops",
    colorNames: ["navy"],
    primaryColorHex: "#1b2a4a",
    pattern: "solid",
    availabilityStatus: "available",
    favorite: true,
    wearCount: 7,
  };
}

function variant(mode: StudioVariant["mode"], candidateId: string): StudioVariant {
  return {
    mode,
    candidateId,
    title: "A look",
    items: [item("top-1", "top", 0), item("bottom-1", "bottom", 1)],
    reasons: ["warm enough"],
    warnings: [],
    stylistNote: "The dependable version of today.",
    confidence: 0.8,
    styleTags: ["minimal"],
    canVisualize: true,
  };
}

function response(): StudioVariantsResponse {
  return {
    variants: [variant("safe", "candidate-a"), variant("fresh", "candidate-b")],
    contextSummary: "Mild and dry.",
    shortfallReason: null,
    generationId: null,
  };
}

const REPLACEMENT: SwapCandidate = {
  id: "top-2",
  name: "Cream knit",
  layer_role: "top",
  category: "tops",
  subcategory: "knitwear",
};

describe("applySwap", () => {
  it("replaces the garment while keeping its role and position", () => {
    const swapped = applySwap(response(), "candidate-a", "top-1", REPLACEMENT);
    const items = swapped.variants[0]!.items;
    expect(items[0]).toMatchObject({
      itemId: "top-2",
      name: "Cream knit",
      role: "top",
      sortOrder: 0,
    });
    expect(items[1]!.itemId).toBe("bottom-1");
  });

  it("touches only the variant that was swapped", () => {
    const swapped = applySwap(response(), "candidate-a", "top-1", REPLACEMENT);
    expect(swapped.variants[1]!.items[0]!.itemId).toBe("top-1");
    expect(swapped.variants[1]!.stylistNote).toBe("The dependable version of today.");
  });

  it("does not carry the old garment's colours or wear history onto the new one", () => {
    const swapped = applySwap(response(), "candidate-a", "top-1", REPLACEMENT);
    expect(swapped.variants[0]!.items[0]).toMatchObject({
      colorNames: [],
      primaryColorHex: null,
      pattern: null,
      favorite: false,
      wearCount: 0,
    });
  });

  it("stops attributing the stylist's note to a look they did not choose", () => {
    const swapped = applySwap(response(), "candidate-a", "top-1", REPLACEMENT);
    expect(swapped.variants[0]!.stylistNote).toMatch(/you swapped a piece/i);
  });

  it("leaves the response untouched when the item is not in that variant", () => {
    const swapped = applySwap(response(), "candidate-a", "not-present", REPLACEMENT);
    expect(swapped.variants[0]!.items.map((entry) => entry.itemId)).toEqual(["top-1", "bottom-1"]);
  });

  it("does not mutate the original response", () => {
    const original = response();
    applySwap(original, "candidate-a", "top-1", REPLACEMENT);
    expect(original.variants[0]!.items[0]!.itemId).toBe("top-1");
  });
});
