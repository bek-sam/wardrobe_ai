import { resolveOccasionContextWithEscalation } from "@/lib/ai/agents/occasion-agent";
import { getPreferences } from "@/lib/ai/tools/get-preferences";
import { getServerEnvironment } from "@/lib/env/server";

import { composeOutfit } from "./compose-outfit";
import { resolveOrchestratorWeather } from "./resolve-weather";
import { retrieveAlternatives } from "./retrieve-alternatives";
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
  const occasionContext = await resolveOccasionContextWithEscalation(input.occasion, input.userId);
  const context = { input, startedAt, environment, style, feedback, weather, weatherWarning };

  // retrieveStoredOutfitCandidates ranks the safest pick first; the other
  // (underused/expressive) alternatives are computed but not yet surfaced in
  // the single-outfit response this endpoint returns today.
  const alternatives = await retrieveAlternatives(input, occasionContext, weather, style, feedback);
  const retrieved = alternatives[0];
  if (retrieved) {
    const retrievedResult = await tryServeRetrievedOutfit({ ...context, profile, retrieved });
    if (retrievedResult) return retrievedResult;
  }

  return composeOutfit({ ...context, occasionContext });
}
