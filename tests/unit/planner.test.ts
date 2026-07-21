import { describe, expect, it } from "vitest";

import {
  getUnavailableItemIds,
  hasCompleteOutfitStructure,
  outfitCombinationKey,
  outfitFoundationKey,
  selectBalancedOutfitPlans,
} from "@/lib/recommendation";

import { ITEM_IDS, makeWardrobeItem } from "./fixtures";

const items = [
  makeWardrobeItem({ id: ITEM_IDS.topA, name: "Top A", layer_role: "top" }),
  makeWardrobeItem({ id: ITEM_IDS.topB, name: "Top B", layer_role: "top" }),
  makeWardrobeItem({
    id: ITEM_IDS.bottomA,
    name: "Bottom A",
    category: "bottoms",
    layer_role: "bottom",
  }),
  makeWardrobeItem({
    id: ITEM_IDS.bottomB,
    name: "Bottom B",
    category: "bottoms",
    layer_role: "bottom",
  }),
  makeWardrobeItem({
    id: ITEM_IDS.shoes,
    name: "Shoes",
    category: "shoes",
    layer_role: "shoes",
  }),
  makeWardrobeItem({
    id: ITEM_IDS.shoesB,
    name: "Other shoes",
    category: "shoes",
    layer_role: "shoes",
  }),
  makeWardrobeItem({
    id: ITEM_IDS.dress,
    name: "Dress",
    category: "dresses",
    layer_role: "dress",
  }),
];

describe("outfit planning helpers", () => {
  it("uses an order-independent exact combination key", () => {
    expect(outfitCombinationKey([ITEM_IDS.topA, ITEM_IDS.bottomA])).toBe(
      outfitCombinationKey([ITEM_IDS.bottomA, ITEM_IDS.topA]),
    );
  });

  it("requires one dress or exactly one top and one bottom foundation", () => {
    expect(outfitFoundationKey([ITEM_IDS.topA, ITEM_IDS.bottomA], items)).toBe(
      `${ITEM_IDS.topA}:${ITEM_IDS.bottomA}`,
    );
    expect(outfitFoundationKey([ITEM_IDS.topA, ITEM_IDS.shoes], items)).toBeNull();
    expect(outfitFoundationKey([ITEM_IDS.dress], items)).toBe(`dress:${ITEM_IDS.dress}`);
    expect(hasCompleteOutfitStructure([ITEM_IDS.dress, ITEM_IDS.shoes], items)).toBe(true);
    expect(
      hasCompleteOutfitStructure([ITEM_IDS.dress, ITEM_IDS.topA, ITEM_IDS.bottomA], items),
    ).toBe(false);
    expect(
      hasCompleteOutfitStructure(
        [ITEM_IDS.topA, ITEM_IDS.bottomA, ITEM_IDS.shoes, ITEM_IDS.shoesB],
        items,
      ),
    ).toBe(false);
  });

  it("reports missing and unavailable item IDs", () => {
    const laundryItems = items.map((item) =>
      item.id === ITEM_IDS.bottomA
        ? makeWardrobeItem({ ...item, availability_status: "laundry" })
        : item,
    );

    expect(
      getUnavailableItemIds([ITEM_IDS.topA, ITEM_IDS.bottomA, ITEM_IDS.unknown], laundryItems),
    ).toEqual([ITEM_IDS.bottomA, ITEM_IDS.unknown]);
  });

  it("selects unique, available looks while balancing repeated garment use", () => {
    const proposals = [
      {
        id: "highest",
        item_ids: [ITEM_IDS.topA, ITEM_IDS.bottomA],
        base_score: 0.9,
      },
      {
        id: "shares-top",
        item_ids: [ITEM_IDS.topA, ITEM_IDS.bottomB],
        base_score: 0.89,
      },
      {
        id: "same-foundation-extra-shoes",
        item_ids: [ITEM_IDS.topA, ITEM_IDS.bottomA, ITEM_IDS.shoes],
        base_score: 0.88,
      },
      {
        id: "balanced",
        item_ids: [ITEM_IDS.topB, ITEM_IDS.bottomB],
        base_score: 0.86,
      },
      {
        id: "duplicate-lower-score",
        item_ids: [ITEM_IDS.bottomA, ITEM_IDS.topA],
        base_score: 0.5,
      },
      {
        id: "two-pairs-of-shoes",
        item_ids: [ITEM_IDS.topB, ITEM_IDS.bottomA, ITEM_IDS.shoes, ITEM_IDS.shoesB],
        base_score: 0.95,
      },
    ];

    const result = selectBalancedOutfitPlans(proposals, items, { count: 2 });
    expect(result.selected.map((proposal) => proposal.id)).toEqual(["highest", "balanced"]);
    expect(result.rejected).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reason: "duplicate_combination" }),
        expect.objectContaining({ reason: "foundation_repeat_limit" }),
        expect.objectContaining({ reason: "invalid_structure" }),
      ]),
    );
    expect(result.usageCounts.get(ITEM_IDS.topA)).toBe(1);
    expect(result.usageCounts.get(ITEM_IDS.topB)).toBe(1);
  });
});
