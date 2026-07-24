import { retrieveStoredOutfitCandidates } from "@/lib/ai/agents/retrieve-outfit-candidate";
import type { getPreferences } from "@/lib/ai/tools/get-preferences";
import type { getWeatherForStyling } from "@/lib/ai/tools/get-weather";
import type { OccasionContext } from "@/lib/recommendation";

import type { StylistOrchestratorInput } from "./types";

export async function retrieveAlternatives(
  input: StylistOrchestratorInput,
  occasionContext: OccasionContext,
  weather: Awaited<ReturnType<typeof getWeatherForStyling>>,
  style: Awaited<ReturnType<typeof getPreferences>>["style"],
  feedback: Awaited<ReturnType<typeof getPreferences>>["feedback"],
) {
  return retrieveStoredOutfitCandidates({
    userId: input.userId,
    occasionContext,
    targetFormality: input.targetFormality ?? style.preferred_formality ?? undefined,
    weather: weather?.constraints,
    preferences: {
      favoriteColors: style.favorite_colors,
      avoidedColors: style.avoided_colors,
      preferredFits: style.preferred_fits,
      likedItemIds: feedback.likedItemIds,
      dislikedItemIds: feedback.dislikedItemIds,
    },
  }).catch(() => []);
}
