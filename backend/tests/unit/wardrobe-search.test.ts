import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { buildItemQuery } from "@/lib/ai/agents/orchestrator/intent";
import {
  rankWardrobeRows,
  searchWardrobeItems,
  type WardrobeSearchRow,
} from "@/lib/wardrobe-search";

function row(overrides: Partial<WardrobeSearchRow>): WardrobeSearchRow {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Item",
    brand: null,
    product_name: null,
    category: "tops",
    subcategory: null,
    layer_role: "top",
    color_names: [],
    pattern: null,
    fit: null,
    season_tags: [],
    occasion_tags: [],
    availability_status: "available",
    favorite: false,
    wear_count: 0,
    last_worn_at: null,
    ...overrides,
  };
}

const navyBlazer = row({
  id: "11111111-1111-4111-8111-111111111111",
  name: "Navy wool blazer",
  category: "outerwear",
  layer_role: "layer",
  color_names: ["navy", "blue"],
  wear_count: 4,
});
const redBlazer = row({
  id: "22222222-2222-4222-8222-222222222222",
  name: "Red linen blazer",
  category: "outerwear",
  layer_role: "layer",
  color_names: ["red"],
});
const blueShirt = row({
  id: "33333333-3333-4333-8333-333333333333",
  name: "Blue oxford shirt",
  color_names: ["blue"],
  availability_status: "laundry",
});

function pagedClient(rows: WardrobeSearchRow[]) {
  const query = {
    from: () => query,
    select: () => query,
    eq: () => query,
    is: () => query,
    order: () => query,
    range: (from: number, to: number) =>
      Promise.resolve({ data: rows.slice(from, to + 1), error: null }),
  };
  return query as unknown as SupabaseClient;
}

describe("wardrobe item lookup", () => {
  it("requires the colour and garment words to match", () => {
    const result = rankWardrobeRows(
      [navyBlazer, redBlazer, blueShirt],
      buildItemQuery("Do I own a blue blazer?"),
    );
    expect(result.matchCount).toBe(1);
    expect(result.matches[0]?.itemId).toBe(navyBlazer.id);
  });

  it("returns every garment of a type when no colour is named", () => {
    const result = rankWardrobeRows(
      [navyBlazer, redBlazer, blueShirt],
      buildItemQuery("how many blazers do I have?"),
    );
    expect(result.matchCount).toBe(2);
  });

  it("honours availability and favourite filters", () => {
    const query = buildItemQuery("show me my clean blue shirts");
    expect(rankWardrobeRows([blueShirt], query).matchCount).toBe(0);
    expect(
      rankWardrobeRows([{ ...blueShirt, availability_status: "available" }], query).matchCount,
    ).toBe(1);
  });

  it("matches nothing when the request carries no searchable term", () => {
    expect(rankWardrobeRows([navyBlazer], buildItemQuery("do I have any?")).matchCount).toBe(0);
  });

  it("paginates beyond 500 rows instead of silently missing later items", async () => {
    const filler = Array.from({ length: 500 }, (_unused, index) =>
      row({
        id: `10000000-0000-4000-8000-${index.toString().padStart(12, "0")}`,
        name: `Cotton shirt ${index}`,
      }),
    );
    const result = await searchWardrobeItems(
      pagedClient([...filler, navyBlazer]),
      "00000000-0000-4000-8000-000000000001",
      buildItemQuery("do I own a navy blazer?"),
    );

    expect(result.scannedCount).toBe(501);
    expect(result.matches[0]?.itemId).toBe(navyBlazer.id);
  });
});
