import { classifyWardrobeIntentDetailed } from "./classify-intent";
import { resolveRequestDateRange } from "./date-range";
import { extractTripDestination } from "./destination";
import { resolveInsightSlots } from "./insight-focus";
import { buildItemQuery } from "./item-query";
import { classifyWardrobeIntentWithModel } from "./model-classifier";
import { collapseSingleDayPlanning } from "./plan-window";
import type { ResolvedIntent } from "./types";

const ESCALATION_CONFIDENCE_THRESHOLD = 0.6;

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
export async function resolveWardrobeIntent(input: {
  request: string;
  date: string;
  userId: string;
}): Promise<ResolvedIntent> {
  const resolved = resolveWardrobeIntentDeterministic(input.request, input.date);
  if (resolved.confidence >= ESCALATION_CONFIDENCE_THRESHOLD) return resolved;

  const escalated = await classifyWardrobeIntentWithModel(input.request, input.userId);
  return escalated
    ? collapseSingleDayPlanning({ ...resolved, ...escalated, source: "model" })
    : resolved;
}
