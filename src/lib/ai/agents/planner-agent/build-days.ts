import { getWardrobeCandidates } from "@/lib/ai/tools/get-wardrobe";
import { getWeatherForStyling } from "@/lib/ai/tools/get-weather";
import type { getPreferences } from "@/lib/ai/tools/get-preferences";
import { confidentOccasionTags, resolveOccasionContext } from "@/lib/recommendation";
import type { WardrobeItem } from "@/features/wardrobe/types";

import type { PlannerDay, PlannerDayInput } from "./types";

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
