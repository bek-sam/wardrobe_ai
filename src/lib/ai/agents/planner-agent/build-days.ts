import { getWardrobeCandidates } from "@/lib/ai/tools/get-wardrobe";
import { getWeatherForStyling } from "@/lib/ai/tools/get-weather";
import type { getPreferences } from "@/lib/ai/tools/get-preferences";
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
    const candidates = await getWardrobeCandidates({
      userId,
      weather: weather?.constraints,
      occasionTags: day.occasion ? [day.occasion] : [],
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
