import { describe, expect, it } from "vitest";

import { validateGeneratedOutfit } from "@/lib/recommendation";

import { ITEM_IDS, makeWardrobeItem, OTHER_USER_ID, USER_ID } from "./fixtures";

const baseResult = {
  title: "Navy and camel",
  explanation: "A balanced smart-casual outfit.",
  warnings: [],
  confidence: 0.88,
  missing_category: null,
  follow_up_question: null,
};

const top = makeWardrobeItem();
const bottom = makeWardrobeItem({
  id: ITEM_IDS.bottomA,
  name: "Camel trousers",
  category: "bottoms",
  layer_role: "bottom",
  primary_color_hex: "#c19a6b",
  color_names: ["camel"],
});
const dress = makeWardrobeItem({
  id: ITEM_IDS.dress,
  name: "Navy column dress",
  category: "dresses",
  layer_role: "dress",
});

describe("generated outfit validation", () => {
  it("accepts exact owned candidate IDs with one top and one bottom", () => {
    const result = validateGeneratedOutfit(
      {
        ...baseResult,
        items: [
          { item_id: top.id, role: "top" },
          { item_id: bottom.id, role: "bottom" },
        ],
      },
      [top, bottom],
      { expectedUserId: USER_ID },
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.outfit.resolvedItems.map((item) => item.id)).toEqual([top.id, bottom.id]);
      expect(result.outfit.combinationKey).toBe([top.id, bottom.id].sort().join(":"));
    }
  });

  it("accepts one owned dress as a complete one-piece foundation", () => {
    const result = validateGeneratedOutfit(
      { ...baseResult, items: [{ item_id: dress.id, role: "dress" }] },
      [dress],
      { expectedUserId: USER_ID },
    );

    expect(result.success).toBe(true);
  });

  it("rejects an invented item ID even when the outfit shape is valid", () => {
    const result = validateGeneratedOutfit(
      {
        ...baseResult,
        items: [
          { item_id: ITEM_IDS.unknown, role: "top" },
          { item_id: bottom.id, role: "bottom" },
        ],
      },
      [top, bottom],
    );

    expect(result.success).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "unknown_item", itemId: ITEM_IDS.unknown }),
      ]),
    );
  });

  it("rejects unavailable, wrong-role, and wrong-owner candidates", () => {
    const mislabeledBottom = makeWardrobeItem({
      id: ITEM_IDS.topB,
      availability_status: "laundry",
      user_id: OTHER_USER_ID,
      category: "tops",
      layer_role: "top",
    });
    const result = validateGeneratedOutfit(
      {
        ...baseResult,
        items: [
          { item_id: top.id, role: "top" },
          { item_id: mislabeledBottom.id, role: "bottom" },
        ],
      },
      [top, mislabeledBottom],
      { expectedUserId: USER_ID },
    );

    expect(result.success).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["wrong_owner", "unavailable", "role_mismatch"]),
    );
  });

  it("rejects duplicate items and an incomplete top/bottom foundation at schema level", () => {
    const result = validateGeneratedOutfit(
      {
        ...baseResult,
        items: [
          { item_id: top.id, role: "top" },
          { item_id: top.id, role: "shoes" },
        ],
      },
      [top],
    );

    expect(result.success).toBe(false);
    expect(result.issues.every((issue) => issue.code === "schema")).toBe(true);
  });
});
