import type { OutfitAnswer, WardrobeAnswer } from "./answers.types";
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
import type { StylistOrchestratorInput } from "./types";

/**
 * The classified intent is a route, not a label: each branch runs the tool
 * that can actually answer that question. Only "outfit_request" composes an
 * outfit, so an item lookup or a wear-history question never spends a stylist
 * call trying to dress the user.
 *
 * `resolved` comes from the authenticated chat boundary, which has to know the
 * route before it can charge the right quota. Threading it through is what
 * guarantees a request is classified exactly once per turn.
 */
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

/**
 * Outfit-only entry point for callers that must receive an outfit (the
 * generate-and-save endpoint). Intent is still resolved deterministically so
 * a date named in the message ("for tomorrow") is honoured, but no other
 * route can be taken and no classification model call is made.
 */
export function runWardrobeOutfitRequest(input: StylistOrchestratorInput): Promise<OutfitAnswer> {
  const resolved = resolveWardrobeIntentDeterministic(input.request, input.date);
  return answerOutfitRequest(input, { ...resolved, intent: "outfit_request" });
}
