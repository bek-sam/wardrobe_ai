import { resolveOccasionContextWithEscalation } from "@/lib/ai/agents/occasion-agent";
import { runOutfitVariantsAgent } from "@/lib/ai/agents/outfit-variants-agent";
import { getPreferences } from "@/lib/ai/tools/get-preferences";

import { buildAgentWeatherContext } from "../agent-weather-context";
import { requireStylistModel } from "../require-model";
import { resolveOrchestratorWeather } from "../resolve-weather";
import { retrieveAlternatives } from "../retrieve-alternatives";
import type { StylistOrchestratorInput } from "../types";
import { assembleVariantViews } from "./assemble-variants";
import { buildVariantInput } from "./build-variant-input";
import { keepLockedCandidates } from "./keep-locked";
import { recordVariantsRun } from "./record-run";
import { emptyVariantsAnswer, variantShortfallReason } from "./shortfall-reason";
import type { OutfitVariantsAnswer } from "./variants.types";

/**
 * Surfaces every validated alternative retrieval found instead of discarding
 * two of the three. Retrieval and the deterministic validator have already
 * enforced ownership, availability, weather, role, and foundation rules; the
 * single model call here only writes the explanations.
 */
export async function answerOutfitVariants(
  input: StylistOrchestratorInput,
  lockedItemIds: readonly string[] = [],
): Promise<OutfitVariantsAnswer> {
  const startedAt = Date.now();
  const environment = requireStylistModel();
  const { profile, style, feedback } = await getPreferences(input.userId);
  const { weather } = await resolveOrchestratorWeather(input.date, input.location, profile, style);
  const occasionContext = await resolveOccasionContextWithEscalation(input.occasion, input.userId);
  const retrieved = await retrieveAlternatives(input, occasionContext, weather, style, feedback);
  // Locks are a hard filter applied before any model call: a candidate that
  // does not contain every locked item can never be served, so remix is
  // structurally incapable of changing a locked piece.
  const candidates = keepLockedCandidates(retrieved, lockedItemIds);

  if (candidates.length === 0) return emptyVariantsAnswer(weather);

  const agent = await runOutfitVariantsAgent({
    userId: input.userId,
    request: input.request,
    occasion: input.occasion ?? null,
    weather: buildAgentWeatherContext(weather, input.indoorOutdoor),
    preferences: { ...style, feedback },
    variants: candidates.map(buildVariantInput),
  });
  const variants = await assembleVariantViews(input.userId, candidates, agent.result);

  return {
    kind: "variants",
    generationId: await recordVariantsRun(input, agent, variants, startedAt, environment),
    variants,
    contextSummary: agent.result.contextSummary,
    weather,
    shortfallReason: variantShortfallReason(variants.length),
  };
}
