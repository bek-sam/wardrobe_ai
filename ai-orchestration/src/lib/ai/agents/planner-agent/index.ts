import type { WardrobeItem } from "@/features/wardrobe";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIClient } from "@/lib/ai/client";
import { plannerResultSchema } from "@/lib/ai/schemas";
import { requireEnvironment } from "@/lib/env/server";
import type { PlannerResult } from "@/lib/ai/schemas";
import { hasCompleteOutfitStructure, outfitCombinationKey } from "@/lib/recommendation";

export type PlannerDayInput = {
  date: string;
  location?: string | null;
  occasion?: string | null;
};

export type PlannerDayWeather = unknown;

export type PlannerDay = {
  date: string;
  occasion: string | null;
  weather: PlannerDayWeather;
  eligibleItemIds: readonly string[];
};

export type RunPlannerAgentInput = {
  userId: string;
  days: readonly PlannerDay[];
  candidates: readonly WardrobeItem[];
  preferences: unknown;
};

function validatePlannerResult(
  result: PlannerResult,
  days: readonly PlannerDay[],
  candidates: readonly WardrobeItem[],
) {
  const itemMap = new Map(candidates.map((item) => [item.id, item]));
  const dayMap = new Map(days.map((day) => [day.date, new Set(day.eligibleItemIds)]));
  const seenDates = new Set<string>();
  const seenCombinations = new Set<string>();
  for (const look of result.looks) {
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
  if (seenDates.size !== days.length) {
    throw new Error("The planner did not return one look for every requested day.");
  }
}

function buildPlannerCandidateSummary(item: WardrobeItem) {
  return {
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
  };
}

const PLANNER_AGENT_INSTRUCTIONS =
  "Plan one complete, unique outfit for each requested date using only supplied owned-item IDs. Each outfit needs either exactly one dress or exactly one top and one bottom, with at most one optional layer, shoes, and accessory. Never combine a dress with a top or bottom. Respect each day's eligibleItemIds, weather, occasion, availability, and preferences. Minimize unnecessary repeats, balance garment usage, reuse versatile layers intelligently, and never invent an owned item. Use tonal or analogous harmony by default, controlled contrast for a statement piece, and physically plausible silhouettes. Explain each look concisely and report missing categories honestly.";

export async function runPlannerAgent(input: RunPlannerAgentInput) {
  const environment = requireEnvironment("OPENAI_PLANNER_MODEL");
  const client = getOpenAIClient();
  const response = await client.responses.parse({
    model: environment.OPENAI_PLANNER_MODEL,
    instructions: PLANNER_AGENT_INSTRUCTIONS,
    input: JSON.stringify({
      days: input.days,
      preferences: input.preferences,
      candidates: input.candidates.map(buildPlannerCandidateSummary),
    }),
    text: { format: zodTextFormat(plannerResultSchema, "wardrobe_week_plan") },
    safety_identifier: input.userId,
    store: false,
  });
  if (!response.output_parsed) throw new Error("The planner did not return a valid plan.");

  validatePlannerResult(response.output_parsed, input.days, input.candidates);
  return { result: response.output_parsed, responseId: response.id, usage: response.usage };
}
