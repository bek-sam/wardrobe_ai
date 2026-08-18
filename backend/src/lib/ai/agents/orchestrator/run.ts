import { answerInsightRequest } from "./handlers/insight";
import { answerItemQuestion } from "./handlers/item-question";
import { answerOutfitRequest } from "./handlers/outfit";
import { answerPackingRequest } from "./handlers/packing";
import { answerPlanningRequest } from "./handlers/planning";
import {
  resolveWardrobeIntent,
  resolveWardrobeIntentDeterministic,
  type ResolvedIntent,
} from "./intent";
import type { OutfitAnswer, StylistOrchestratorInput, WardrobeAnswer } from ".";

/** Dispatches a previously billed intent, or resolves it once for direct callers. */
export async function runWardrobeOrchestrator(
  input: StylistOrchestratorInput,
  resolved?: ResolvedIntent,
): Promise<WardrobeAnswer> {
  const route = resolved ?? (await resolveWardrobeIntent(input));
  switch (route.intent) {
    case "item_question":
      return answerItemQuestion(input, route);
    case "insight":
      return answerInsightRequest(input, route);
    case "packing":
      return answerPackingRequest(input, route);
    case "planning":
      return answerPlanningRequest(input, route);
    default:
      return answerOutfitRequest(input, route);
  }
}

/** Outfit-only entry point for generate-and-save callers. */
export function runWardrobeOutfitRequest(input: StylistOrchestratorInput): Promise<OutfitAnswer> {
  const resolved = resolveWardrobeIntentDeterministic(input.request, input.date);
  return answerOutfitRequest(input, { ...resolved, intent: "outfit_request" });
}
