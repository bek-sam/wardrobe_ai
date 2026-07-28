import { classifyWardrobeIntentDetailed } from "./classify-intent";
import { resolveRequestDateRange } from "./date-range";
import { extractTripDestination } from "./destination";
import { resolveInsightSlots } from "./insight-focus";
import { buildItemQuery } from "./item-query";
import {
  canClassifyWardrobeIntentWithModel,
  classifyWardrobeIntentWithModel,
} from "./model-classifier";
import { collapseSingleDayPlanning } from "./plan-window";
import type { ResolvedIntent } from "./types";

export const ESCALATION_CONFIDENCE_THRESHOLD = 0.6;

/**
 * Runs immediately before the one classifier model call, and only then. The
 * authenticated chat boundary passes its rolling-limit check here so routing
 * escalation is rate-limited without charging a generation budget.
 */
export type IntentEscalationGate = () => Promise<unknown>;

/** Slots are always deterministic: only the intent label can come from a model. */
function buildSlots(request: string, baseDate: string) {
  const text = request.toLowerCase();
  const { focus, unwornSince } = resolveInsightSlots(text, baseDate);
  return {
    text,
    range: resolveRequestDateRange(text, baseDate),
    destination: extractTripDestination(request),
    insightFocus: focus,
    unwornSince,
    itemQuery: buildItemQuery(request),
  };
}

export function resolveWardrobeIntentDeterministic(
  request: string,
  baseDate: string,
): ResolvedIntent {
  const slots = buildSlots(request, baseDate);
  const deterministic = classifyWardrobeIntentDetailed(request);
  return collapseSingleDayPlanning({ ...slots, ...deterministic, source: "rules" });
}

/**
 * Keyword rules decide confident requests for free; only genuinely ambiguous
 * text costs one small structured model call, and a failed or unconfigured
 * call keeps the deterministic route.
 */
export async function resolveWardrobeIntent(
  input: { request: string; date: string; userId: string },
  gate?: IntentEscalationGate,
): Promise<ResolvedIntent> {
  const resolved = resolveWardrobeIntentDeterministic(input.request, input.date);
  if (resolved.confidence >= ESCALATION_CONFIDENCE_THRESHOLD) return resolved;
  if (!canClassifyWardrobeIntentWithModel()) return resolved;

  if (gate) await gate();
  const escalated = await classifyWardrobeIntentWithModel(input.request, input.userId);
  return escalated
    ? collapseSingleDayPlanning({ ...resolved, ...escalated, source: "model" })
    : resolved;
}
