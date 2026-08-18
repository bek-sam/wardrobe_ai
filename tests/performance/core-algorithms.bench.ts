import { bench, describe } from "vitest";

import type { OutfitPlanProposal } from "@backend/features/outfits";
import { buildWardrobeInsights } from "@backend/lib/insights";
import { selectBalancedOutfitPlans } from "@backend/lib/recommendation";
import { rankWardrobeRows, type WardrobeSearchRow } from "@backend/lib/wardrobe-search";
import type { WardrobeItem, WardrobeItemRole } from "@worker/features/wardrobe";
import { generateOutfitCandidates } from "@worker/lib/compilation/generate-outfit-candidates";

import { makeWardrobeItem } from "../unit/fixtures";

function uuid(index: number) {
  return `10000000-0000-4000-8000-${index.toString().padStart(12, "0")}`;
}

function roleItem(index: number, role: WardrobeItemRole): WardrobeItem {
  const category = {
    top: "tops",
    bottom: "bottoms",
    dress: "dresses",
    layer: "outerwear",
    shoes: "shoes",
    accessory: "accessories",
  }[role];
  return makeWardrobeItem({
    id: uuid(index),
    name: `${role} ${index}`,
    category,
    layer_role: role,
    color_names: [index % 2 === 0 ? "navy" : "white"],
    primary_color_hex: index % 2 === 0 ? "#1b2a4a" : "#f4f4f0",
    occasion_tags: index % 3 === 0 ? ["work"] : ["casual"],
    season_tags: ["all-season"],
    wear_count: index % 12,
  });
}

function wardrobe(size: number) {
  const roles: WardrobeItemRole[] = ["top", "bottom", "dress", "layer", "shoes", "accessory"];
  return Array.from({ length: size }, (_unused, index) => roleItem(index + 1, roles[index % 6]!));
}

function searchRows(size: number): WardrobeSearchRow[] {
  return Array.from({ length: size }, (_unused, index) => ({
    id: uuid(index + 1),
    name: index % 4 === 0 ? `Navy wool blazer ${index}` : `Cotton shirt ${index}`,
    brand: null,
    product_name: null,
    category: index % 4 === 0 ? "outerwear" : "tops",
    subcategory: null,
    layer_role: index % 4 === 0 ? "layer" : "top",
    color_names: [index % 4 === 0 ? "navy" : "white"],
    pattern: null,
    fit: null,
    season_tags: ["all-season"],
    occasion_tags: ["work"],
    availability_status: "available",
    favorite: index % 10 === 0,
    wear_count: index % 20,
    last_worn_at: null,
  }));
}

function insightRows(size: number) {
  return wardrobe(size).map((item, index) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    subcategory: item.subcategory,
    layer_role: item.layer_role,
    color_names: item.color_names,
    season_tags: item.season_tags,
    wear_count: item.wear_count,
    last_worn_at: item.last_worn_at,
    purchase_price: index % 2 === 0 ? index + 25 : null,
    currency: "USD",
  }));
}

function plannerData(combinations: number) {
  const items = wardrobe(120);
  const tops = items.filter((item) => item.layer_role === "top");
  const bottoms = items.filter((item) => item.layer_role === "bottom");
  const proposals: OutfitPlanProposal[] = Array.from(
    { length: combinations },
    (_unused, index) => ({
      id: `proposal-${index}`,
      item_ids: [tops[index % tops.length]!.id, bottoms[(index * 7) % bottoms.length]!.id],
      base_score: 1 - index / Math.max(1, combinations * 2),
    }),
  );
  return { items, proposals };
}

const search500 = searchRows(500);
const insights500 = insightRows(500);
const candidates80 = wardrobe(80);
const candidates500 = wardrobe(500);
const planner1000 = plannerData(1000);

describe("bounded in-memory algorithms", () => {
  bench("rank 500 wardrobe rows", () => {
    rankWardrobeRows(search500, {
      raw: "navy blazer",
      terms: ["navy", "blazer"],
      colors: ["navy"],
      categories: ["blazer"],
      favoritesOnly: false,
      availableOnly: true,
    });
  });

  bench("build insights for 500 items", () => {
    buildWardrobeInsights(insights500);
  });

  bench(
    "construct candidate proposals for 80 items",
    () => {
      generateOutfitCandidates(candidates80, { maxCandidates: 0 });
    },
    { time: 500, warmupTime: 100 },
  );

  bench(
    "compile candidates for 80 items",
    () => {
      generateOutfitCandidates(candidates80);
    },
    { time: 500, warmupTime: 100 },
  );

  bench(
    "compile candidates for 500 items",
    () => {
      generateOutfitCandidates(candidates500);
    },
    { time: 250, warmupTime: 50 },
  );

  bench("balance 1,000 plan proposals", () => {
    selectBalancedOutfitPlans(planner1000.proposals, planner1000.items, { count: 7 });
  });
});
