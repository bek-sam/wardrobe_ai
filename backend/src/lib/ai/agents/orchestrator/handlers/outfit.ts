import { resolveOccasionContextWithEscalation } from "@/lib/ai/agents/occasion-agent";
import { getPreferences } from "@/lib/ai/tools/get-preferences";

import type { OutfitAnswer } from "..";
import { composeOutfit } from "..";
import type { ResolvedIntent } from "../intent";
import { requireStylistModel } from "..";
import { resolveOrchestratorWeather } from "..";
import { retrieveAlternatives } from "..";
import { tryServeRetrievedOutfit } from "..";
import type { StylistOrchestratorInput } from "..";

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
  requireStylistModel();
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
