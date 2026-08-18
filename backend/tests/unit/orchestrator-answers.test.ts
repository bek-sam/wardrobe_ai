import { describe, expect, it } from "vitest";

import { sanitizeStylistStructuredResult } from "@/features/stylist";
import { buildItemQuery } from "@/lib/ai/agents/orchestrator/intent";
import type { PlanDayView } from "@/lib/ai/agents/orchestrator";
import {
  buildPackingEssentials,
  buildPackingList,
} from "@/lib/ai/agents/orchestrator/handlers/support";
import { buildInsightHighlights } from "@/lib/ai/agents/orchestrator/handlers/support";
import { insightAnswerText } from "@/lib/ai/agents/orchestrator/handlers/support";
import { itemAnswerText } from "@/lib/ai/agents/orchestrator/handlers/support";
import { buildUnwornItems, buildWardrobeInsights, type InsightItem } from "@/lib/insights";

const blazerId = "11111111-1111-4111-8111-111111111111";
const jeansId = "22222222-2222-4222-8222-222222222222";
const bootsId = "33333333-3333-4333-8333-333333333333";

function planDay(date: string, extraItemId?: string): PlanDayView {
  return {
    date,
    title: `Look for ${date}`,
    explanation: "Owned items only.",
    confidence: 0.8,
    occasion: null,
    items: [
      {
        item_id: blazerId,
        role: "layer",
        sort_order: 0,
        name: "Navy blazer",
        category: "outerwear",
      },
      ...(extraItemId
        ? [
            {
              item_id: extraItemId,
              role: "bottom" as const,
              sort_order: 1,
              name: "Grey jeans",
              category: "bottoms",
            },
          ]
        : []),
    ],
    weather: {
      locationName: "Chicago",
      minimumTemperatureC: 12,
      maximumTemperatureC: 19,
      precipitationProbability: 70,
      tags: ["rain_protection"],
    },
  };
}

function insightItem(overrides: Partial<InsightItem>): InsightItem {
  return {
    id: blazerId,
    name: "Navy blazer",
    category: "outerwear",
    subcategory: null,
    layer_role: "layer",
    color_names: ["navy"],
    season_tags: [],
    wear_count: 0,
    last_worn_at: null,
    purchase_price: null,
    currency: null,
    ...overrides,
  };
}

describe("packing answer", () => {
  it("counts each distinct item once and tracks reuse across days", () => {
    const list = buildPackingList([planDay("2026-07-27", jeansId), planDay("2026-07-28")]);
    expect(list).toHaveLength(2);
    expect(list.find((entry) => entry.itemId === blazerId)?.dayCount).toBe(2);
    expect(list.find((entry) => entry.itemId === jeansId)?.dayCount).toBe(1);
  });

  it("derives essentials from the forecast constraints, not from a model", () => {
    expect(buildPackingEssentials([planDay("2026-07-27")])).toEqual(["rain protection"]);
    expect(buildPackingEssentials([{ ...planDay("2026-07-27"), weather: null }])).toEqual([]);
  });
});

describe("insight answer", () => {
  const items = [
    insightItem({ id: blazerId, wear_count: 0 }),
    insightItem({
      id: jeansId,
      name: "Grey jeans",
      category: "bottoms",
      layer_role: "bottom",
      wear_count: 12,
      last_worn_at: "2025-11-02T09:00:00.000Z",
    }),
    insightItem({
      id: bootsId,
      name: "Brown boots",
      category: "shoes",
      layer_role: "shoes",
      wear_count: 3,
      last_worn_at: "2026-07-01T09:00:00.000Z",
    }),
  ];

  it("answers 'not worn this year' from wear timestamps", () => {
    const unworn = buildUnwornItems(items, "2026-01-01", "2026-07-24");
    expect(unworn.map((entry) => entry.item.id)).toEqual([blazerId, jeansId]);

    const insights = buildWardrobeInsights(items);
    const highlights = buildInsightHighlights("unworn", insights, unworn);
    expect(highlights[0]).toMatchObject({ label: "Navy blazer", detail: "never worn" });
    const text = insightAnswerText(
      "unworn",
      { itemCount: 3, neverWornCount: 1, unwornCount: 2, possibleFoundations: 1 },
      "2026-01-01",
      highlights,
    );
    expect(text).toContain("2 of your 3 active items");
    expect(text).toContain("2026-01-01");
  });

  it("only counts never-worn items when no period is named", () => {
    expect(buildUnwornItems(items, null, "2026-07-24").map((entry) => entry.item.id)).toEqual([
      blazerId,
    ]);
  });

  it("states an empty wardrobe plainly", () => {
    const text = insightAnswerText(
      "overview",
      { itemCount: 0, neverWornCount: 0, unwornCount: 0, possibleFoundations: 0 },
      null,
      [],
    );
    expect(text).toContain("empty");
  });
});

describe("item question answer", () => {
  const match = {
    itemId: blazerId,
    name: "Navy wool blazer",
    brand: null,
    category: "outerwear",
    subcategory: null,
    colorNames: ["navy"],
    availability: "available" as const,
    favorite: false,
    wearCount: 2,
    lastWornAt: null,
    score: 6,
  };

  it("confirms ownership with the matching item names", () => {
    const text = itemAnswerText(buildItemQuery("Do I own a blue blazer?"), {
      matches: [match],
      matchCount: 1,
      scannedCount: 10,
    });
    expect(text).toContain("Yes — you own 1 item");
    expect(text).toContain("Navy wool blazer");
  });

  it("says so plainly when nothing matches", () => {
    const text = itemAnswerText(buildItemQuery("Do I own a blue blazer?"), {
      matches: [],
      matchCount: 0,
      scannedCount: 10,
    });
    expect(text).toContain("No active item");
  });

  it("asks for a search term when the request carries none", () => {
    const text = itemAnswerText(buildItemQuery("do I have any?"), {
      matches: [],
      matchCount: 0,
      scannedCount: 0,
    });
    expect(text).toContain("Tell me what to look for");
  });
});

describe("non-outfit answer sanitization", () => {
  const storedItemAnswer = {
    kind: "item_question",
    intent: "item_question",
    generationId: "5985ac32-bb23-4c1a-99bf-a966b106b07b",
    answer: "Yes — you own 1 item matching “blue blazer”: Navy wool blazer.",
    query: "Do I own a blue blazer?",
    matchCount: 1,
    matches: [
      {
        itemId: blazerId,
        name: "Navy wool blazer",
        brand: null,
        category: "outerwear",
        subcategory: null,
        colorNames: ["navy"],
        availability: "available",
        favorite: false,
        wearCount: 2,
        lastWornAt: null,
        score: 6,
        user_id: "private-owner-id",
        internalTrace: [{ hidden: true }],
      },
    ],
    hiddenReasoning: "never return this",
  };

  it("keeps renderable fields and drops everything else", () => {
    const result = sanitizeStylistStructuredResult(storedItemAnswer);
    expect(result).toMatchObject({ kind: "item_question", matchCount: 1 });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("private-owner-id");
    expect(serialized).not.toContain("internalTrace");
    expect(serialized).not.toContain("hiddenReasoning");
  });

  it("nulls malformed answers instead of partially trusting them", () => {
    expect(sanitizeStylistStructuredResult({ kind: "packing" })).toBeNull();
    expect(sanitizeStylistStructuredResult({ kind: "unknown_kind", answer: "hi" })).toBeNull();
  });

  it("still sanitizes plan answers with their day breakdown", () => {
    const result = sanitizeStylistStructuredResult({
      kind: "plan",
      intent: "planning",
      generationId: null,
      answer: "Here is a 2-day plan.",
      startDate: "2026-07-27",
      endDate: "2026-07-28",
      dayCount: 2,
      days: [planDay("2026-07-27", jeansId), planDay("2026-07-28")],
      missingCategories: [],
      saved: false,
    });
    expect(result).toMatchObject({ kind: "plan", dayCount: 2 });
  });
});
