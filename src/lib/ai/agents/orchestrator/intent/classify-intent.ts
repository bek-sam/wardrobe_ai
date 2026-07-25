import { INTENT_PRIORITY, INTENT_RULES } from "./rules.data";
import type { IntentScore, WardrobeIntent } from "./types";

function scoreWardrobeIntents(text: string) {
  const scores = new Map<WardrobeIntent, number>();
  for (const rule of INTENT_RULES) {
    if (!rule.pattern.test(text)) continue;
    scores.set(rule.intent, (scores.get(rule.intent) ?? 0) + rule.weight);
  }
  return scores;
}

/**
 * Deterministic keyword classification. Confidence grows with the winning
 * score and with how far it beats the runner-up, so genuinely mixed requests
 * ("something nice for later") stay low enough for model escalation.
 */
export function classifyWardrobeIntentDetailed(request: string): IntentScore {
  const ranked = [...scoreWardrobeIntents(request.toLowerCase()).entries()].sort(
    ([firstIntent, firstScore], [secondIntent, secondScore]) =>
      secondScore - firstScore ||
      INTENT_PRIORITY.indexOf(firstIntent) - INTENT_PRIORITY.indexOf(secondIntent),
  );
  const top = ranked[0];
  if (!top) return { intent: "outfit_request", confidence: 0.35 };
  const margin = top[1] - (ranked[1]?.[1] ?? 0);
  const confidence = Math.min(0.95, 0.35 + 0.08 * top[1] + 0.12 * margin);
  return { intent: top[0], confidence: Number(confidence.toFixed(2)) };
}

export function classifyWardrobeIntent(request: string): WardrobeIntent {
  return classifyWardrobeIntentDetailed(request).intent;
}
