import { retrieveStoredOutfitCandidates } from "@/lib/ai/agents/retrieve-outfit-candidate";
import { getPreferences } from "@/lib/ai/tools/get-preferences";
import { getServerEnvironment } from "@/lib/env/server";

import { composeOutfit } from "./compose-outfit";
import { resolveOrchestratorWeather } from "./resolve-weather";
import { tryServeRetrievedOutfit } from "./serve-retrieved";
import type { StylistOrchestratorInput } from "./types";

export async function runWardrobeOrchestrator(input: StylistOrchestratorInput) {
  const startedAt = Date.now();
  const environment = getServerEnvironment();
  const { profile, style, feedback } = await getPreferences(input.userId);
  const { weather, weatherWarning } = await resolveOrchestratorWeather(
    input.date,
    input.location,
    profile,
    style,
  );

  const retrievedAlternatives = await retrieveStoredOutfitCandidates({
    userId: input.userId,
    occasion: input.occasion,
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

  // retrieveStoredOutfitCandidates ranks the safest pick first; the other
  // (underused/expressive) alternatives are computed but not yet surfaced in
  // the single-outfit response this endpoint returns today.
  const retrieved = retrievedAlternatives[0];
  if (retrieved) {
    const retrievedResult = await tryServeRetrievedOutfit({
      input,
      startedAt,
      environment,
      profile,
      style,
      feedback,
      weather,
      weatherWarning,
      retrieved,
    });
    if (retrievedResult) return retrievedResult;
  }

  return composeOutfit({ input, startedAt, environment, style, feedback, weather, weatherWarning });
}
