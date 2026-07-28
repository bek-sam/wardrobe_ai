import { resolveOccasionContextWithEscalation } from "@/lib/ai/agents/occasion-agent";
import { getPreferences } from "@/lib/ai/tools/get-preferences";
import { getServerEnvironment } from "@/lib/env/server";

import type { OutfitAnswer } from "../answers.types";
import { composeOutfit } from "../compose-outfit";
import type { ResolvedIntent } from "../intent";
import { resolveOrchestratorWeather } from "../resolve-weather";
import { retrieveAlternatives } from "../retrieve-alternatives";
import { tryServeRetrievedOutfit } from "../serve-retrieved";
import type { StylistOrchestratorInput } from "../types";

/**
 * One outfit for one day. A single-day window found in the request ("dress me
 * for work tomorrow") overrides the caller-supplied date, so the forecast and
 * the look match the day the user actually asked about.
 */
export async function answerOutfitRequest(
  input: StylistOrchestratorInput,
  resolved: ResolvedIntent,
): Promise<OutfitAnswer> {
  const startedAt = Date.now();
  const environment = getServerEnvironment();
  const scoped =
    resolved.range?.dayCount === 1 ? { ...input, date: resolved.range.startDate } : input;

  const { profile, style, feedback } = await getPreferences(input.userId);
  const { weather, weatherWarning } = await resolveOrchestratorWeather(
    scoped.date,
    scoped.location,
    profile,
    style,
  );
  const occasionContext = await resolveOccasionContextWithEscalation(input.occasion, input.userId);
  const context = {
    input: scoped,
    intent: resolved.intent,
    startedAt,
    environment,
    style,
    feedback,
    weather,
    weatherWarning,
  };

  // retrieveStoredOutfitCandidates ranks the safest pick first; the other
  // (underused/expressive) alternatives are computed but not yet surfaced in
  // the single-outfit response this endpoint returns today.
  const alternatives = await retrieveAlternatives(
    scoped,
    occasionContext,
    weather,
    style,
    feedback,
  );
  const retrieved = alternatives[0];
  if (retrieved) {
    const retrievedResult = await tryServeRetrievedOutfit({ ...context, profile, retrieved });
    if (retrievedResult) return retrievedResult;
  }

  return composeOutfit({ ...context, occasionContext });
}
