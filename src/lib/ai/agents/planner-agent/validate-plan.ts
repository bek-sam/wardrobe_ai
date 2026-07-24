import type { WardrobeItem } from "@/features/wardrobe/types";
import type { PlannerResult } from "@/lib/ai/schemas/stylist";
import { hasCompleteOutfitStructure, outfitCombinationKey } from "@/lib/recommendation/planner";

import type { PlannerDay } from "./types";

export function validatePlannerResult(
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
