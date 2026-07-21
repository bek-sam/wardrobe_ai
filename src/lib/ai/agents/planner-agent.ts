import { zodTextFormat } from "openai/helpers/zod";
import type { WardrobeItem } from "@/features/wardrobe/types";
import { getOpenAIClient } from "@/lib/ai/client";
import { plannerResultSchema } from "@/lib/ai/schemas/stylist";
import { requireEnvironment } from "@/lib/env/server";
import { hasCompleteOutfitStructure, outfitCombinationKey } from "@/lib/recommendation/planner";

export type PlannerDay = {
  date: string;
  occasion: string | null;
  weather: unknown;
  eligibleItemIds: readonly string[];
};

export async function runPlannerAgent(input: {
  userId: string;
  days: readonly PlannerDay[];
  candidates: readonly WardrobeItem[];
  preferences: unknown;
}) {
  const environment = requireEnvironment("OPENAI_PLANNER_MODEL");
  const client = getOpenAIClient();
  const response = await client.responses.parse({
    model: environment.OPENAI_PLANNER_MODEL,
    instructions: `Plan one complete, unique outfit for each requested date using only supplied owned-item IDs. Each outfit needs either exactly one dress or exactly one top and one bottom, with at most one optional layer, shoes, and accessory. Never combine a dress with a top or bottom. Respect each day's eligibleItemIds, weather, occasion, availability, and preferences. Minimize unnecessary repeats, balance garment usage, reuse versatile layers intelligently, and never invent an owned item. Use tonal or analogous harmony by default, controlled contrast for a statement piece, and physically plausible silhouettes. Explain each look concisely and report missing categories honestly.`,
    input: JSON.stringify({
      days: input.days,
      preferences: input.preferences,
      candidates: input.candidates.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        subcategory: item.subcategory,
        role: item.layer_role,
        colors: item.color_names,
        pattern: item.pattern,
        fit: item.fit,
        silhouette: item.silhouette,
        warmthLevel: item.warmth_level,
        formalityLevel: item.formality_level,
        occasions: item.occasion_tags,
        weatherTags: item.weather_tags,
        wearCount: item.wear_count,
        lastWornAt: item.last_worn_at,
      })),
    }),
    text: { format: zodTextFormat(plannerResultSchema, "wardrobe_week_plan") },
    safety_identifier: input.userId,
    store: false,
  });
  if (!response.output_parsed) throw new Error("The planner did not return a valid plan.");

  const itemMap = new Map(input.candidates.map((item) => [item.id, item]));
  const dayMap = new Map(input.days.map((day) => [day.date, new Set(day.eligibleItemIds)]));
  const seenDates = new Set<string>();
  const seenCombinations = new Set<string>();
  for (const look of response.output_parsed.looks) {
    const eligible = dayMap.get(look.date);
    if (!eligible || seenDates.has(look.date))
      throw new Error("The planner returned an invalid date.");
    if (look.itemIds.some((id) => !eligible.has(id) || !itemMap.has(id))) {
      throw new Error("The planner selected an ineligible or unowned item.");
    }
    if (!hasCompleteOutfitStructure(look.itemIds, itemMap)) {
      throw new Error("The planner returned an incomplete outfit foundation.");
    }
    const combination = outfitCombinationKey(look.itemIds);
    if (seenCombinations.has(combination)) throw new Error("The planner repeated an outfit.");
    seenDates.add(look.date);
    seenCombinations.add(combination);
  }
  if (seenDates.size !== input.days.length) {
    throw new Error("The planner did not return one look for every requested day.");
  }
  return { result: response.output_parsed, responseId: response.id, usage: response.usage };
}
