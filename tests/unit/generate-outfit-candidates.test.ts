import { describe, expect, it } from "vitest";

import { hasCompleteOutfitStructure } from "@/lib/recommendation";
import {
  generateOutfitCandidates,
  type CompilationBucket,
} from "@/lib/compilation/generate-outfit-candidates";

import { ITEM_IDS, makeWardrobeItem } from "./fixtures";

const items = [
  makeWardrobeItem({ id: ITEM_IDS.topA, name: "Top A", layer_role: "top", formality_level: 2 }),
  makeWardrobeItem({ id: ITEM_IDS.topB, name: "Top B", layer_role: "top", formality_level: 4 }),
  makeWardrobeItem({
    id: ITEM_IDS.bottomA,
    name: "Bottom A",
    category: "bottoms",
    layer_role: "bottom",
    formality_level: 2,
  }),
  makeWardrobeItem({
    id: ITEM_IDS.bottomB,
    name: "Bottom B",
    category: "bottoms",
    layer_role: "bottom",
    formality_level: 4,
  }),
  makeWardrobeItem({
    id: ITEM_IDS.dress,
    name: "Dress",
    category: "dresses",
    layer_role: "dress",
  }),
  makeWardrobeItem({
    id: ITEM_IDS.layer,
    name: "Layer",
    category: "outerwear",
    layer_role: "layer",
  }),
  makeWardrobeItem({
    id: ITEM_IDS.shoes,
    name: "Shoes",
    category: "shoes",
    layer_role: "shoes",
    warmth_level: 2,
  }),
  makeWardrobeItem({
    id: ITEM_IDS.shoesB,
    name: "Shoes B",
    category: "shoes",
    layer_role: "shoes",
    warmth_level: 2,
    water_resistance: "waterproof",
  }),
  makeWardrobeItem({
    id: ITEM_IDS.accessory,
    name: "Accessory",
    category: "accessories",
    layer_role: "accessory",
  }),
];

describe("generateOutfitCandidates", () => {
  it("only produces structurally valid, deduplicated outfits", () => {
    const candidates = generateOutfitCandidates(items);
    expect(candidates.length).toBeGreaterThan(0);

    const combinationKeys = new Set<string>();
    for (const candidate of candidates) {
      const itemIds = candidate.items.map((entry) => entry.itemId);
      expect(hasCompleteOutfitStructure(itemIds, items)).toBe(true);
      expect(combinationKeys.has(candidate.combinationKey)).toBe(false);
      combinationKeys.add(candidate.combinationKey);

      expect(candidate.totalScore).toBeGreaterThanOrEqual(0);
      expect(candidate.totalScore).toBeLessThanOrEqual(1);

      const roles = candidate.items.map((entry) => entry.role);
      expect(new Set(roles).size).toBe(roles.length);
    }
  });

  it("caps the total number of stored candidates", () => {
    const candidates = generateOutfitCandidates(items, { maxCandidates: 3 });
    expect(candidates.length).toBeLessThanOrEqual(3);
  });

  it("tags candidates with the bucket's occasion tags", () => {
    const buckets: CompilationBucket[] = [
      { key: "business", occasionTags: ["work"], targetFormality: 4 },
    ];
    const candidates = generateOutfitCandidates(items, { buckets, maxCandidates: 50 });
    expect(candidates.length).toBeGreaterThan(0);
    for (const candidate of candidates) {
      expect(candidate.occasionTags).toEqual(["work"]);
      expect(candidate.bucketKey).toBe("business");
    }
  });

  it("returns nothing when no foundation (dress, or top+bottom) exists", () => {
    const shoesOnly = items.filter((item) => item.id === ITEM_IDS.shoes);
    expect(generateOutfitCandidates(shoesOnly)).toEqual([]);
  });

  it("assigns a normalized occasionCategory matching the bucket key", () => {
    const candidates = generateOutfitCandidates(items, { maxCandidates: 200 });
    for (const candidate of candidates) {
      expect(candidate.occasionCategory).toBe(candidate.bucketKey);
    }
  });

  it("tags weather_tags from aggregate warmth and marks rain-safe outfits", () => {
    const candidates = generateOutfitCandidates(items, { maxCandidates: 200 });
    const withRainSafeShoes = candidates.filter((candidate) =>
      candidate.items.some((entry) => entry.itemId === ITEM_IDS.shoesB),
    );
    expect(withRainSafeShoes.length).toBeGreaterThan(0);
    for (const candidate of withRainSafeShoes) {
      expect(candidate.weatherTags).toContain("rain_safe");
    }
    for (const candidate of candidates) {
      if (candidate.warmthLevel !== null) expect(candidate.weatherTags.length).toBeGreaterThan(0);
    }
  });

  it("produces multiple footwear variants for the same foundation and bucket", () => {
    const buckets: CompilationBucket[] = [
      { key: "casual", occasionTags: ["casual"], targetFormality: 1 },
    ];
    const candidates = generateOutfitCandidates(items, { buckets, maxCandidates: 200 });
    const dressOutfits = candidates.filter((candidate) =>
      candidate.items.some((entry) => entry.itemId === ITEM_IDS.dress),
    );
    const shoeIdsUsed = new Set(
      dressOutfits.flatMap((candidate) =>
        candidate.items
          .filter((entry) => entry.itemId === ITEM_IDS.shoes || entry.itemId === ITEM_IDS.shoesB)
          .map((entry) => entry.itemId),
      ),
    );
    expect(shoeIdsUsed.has(ITEM_IDS.shoes)).toBe(true);
    expect(shoeIdsUsed.has(ITEM_IDS.shoesB)).toBe(true);
  });

  it("produces both with-layer and without-layer variants when the layer is a good fit", () => {
    const buckets: CompilationBucket[] = [
      { key: "casual", occasionTags: ["casual"], targetFormality: 1 },
    ];
    const candidates = generateOutfitCandidates(items, { buckets, maxCandidates: 200 });
    const dressOutfits = candidates.filter((candidate) =>
      candidate.items.some((entry) => entry.itemId === ITEM_IDS.dress),
    );
    const withLayer = dressOutfits.some((candidate) =>
      candidate.items.some((entry) => entry.itemId === ITEM_IDS.layer),
    );
    const withoutLayer = dressOutfits.some(
      (candidate) => !candidate.items.some((entry) => entry.itemId === ITEM_IDS.layer),
    );
    expect(withLayer).toBe(true);
    expect(withoutLayer).toBe(true);
  });
});
