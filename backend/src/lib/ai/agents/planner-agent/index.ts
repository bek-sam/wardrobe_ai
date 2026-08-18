import type { WardrobeItem } from "@/features/wardrobe";
import { getWardrobeCandidates } from "@/lib/ai/tools/get-wardrobe";
import { getWeatherForStyling } from "@/lib/ai/tools/get-weather";
import type { getPreferences } from "@/lib/ai/tools/get-preferences";
import { confidentOccasionTags, resolveOccasionContext } from "@/lib/recommendation";
import { runAiTask } from "@/lib/ai/client";
import type { PlannerResult } from "@/lib/ai/schemas";
import { hasCompleteOutfitStructure, outfitCombinationKey } from "@/lib/recommendation";

export type PlannerDayInput = {
  date: string;
  location?: string | null;
  occasion?: string | null;
};

export type PlannerDayWeather = Awaited<ReturnType<typeof getWeatherForStyling>>;

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

export async function buildPlannerDays(
  userId: string,
  days: readonly PlannerDayInput[],
  preferences: Awaited<ReturnType<typeof getPreferences>>,
) {
  const { profile, style, feedback } = preferences;
  const candidateMap = new Map<string, WardrobeItem>();
  const plannerDays: PlannerDay[] = [];

  for (const day of days) {
    let weather: Awaited<ReturnType<typeof getWeatherForStyling>> = null;
    try {
      weather = await getWeatherForStyling({
        date: day.date,
        requestedLocation: day.location,
        profile,
        comfort: { runsCold: style.runs_cold, runsHot: style.runs_hot },
      });
    } catch {
      weather = null;
    }
    // The raw occasion text is not a tag. Passing it through as a *required*
    // tag asked the wardrobe for items literally tagged "Casual day", so any
    // item carrying real occasion tags was excluded and the day resolved to
    // no_eligible_items. Resolve to canonical tags the way the outfit path
    // does, and only when the match is confident -- below that bar the day is
    // treated as occasion-agnostic rather than filtered on a guess.
    const occasionTags = confidentOccasionTags(resolveOccasionContext(day.occasion)) ?? [];
    const candidates = await getWardrobeCandidates({
      userId,
      weather: weather?.constraints,
      occasionTags,
      targetFormality: style.preferred_formality ?? undefined,
      favoriteColors: style.favorite_colors,
      avoidedColors: style.avoided_colors,
      preferredFits: style.preferred_fits,
      likedItemIds: feedback.likedItemIds,
      dislikedItemIds: feedback.dislikedItemIds,
    });
    for (const item of candidates.items) candidateMap.set(item.id, item);
    plannerDays.push({
      date: day.date,
      occasion: day.occasion ?? null,
      weather,
      eligibleItemIds: candidates.items.map((item) => item.id),
    });
  }

  return { candidateMap, plannerDays };
}

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

export async function runPlannerAgent(input: RunPlannerAgentInput) {
  const response = await runAiTask<{ result: PlannerResult; responseId: string; usage: unknown }>(
    "plan",
    {
      ...input,
      candidates: input.candidates,
      candidateSummaries: input.candidates.map(buildPlannerCandidateSummary),
    },
  );
  validatePlannerResult(response.result, input.days, input.candidates);
  return response;
}
