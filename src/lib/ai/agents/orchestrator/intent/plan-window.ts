import { buildIntentRange } from "./build-range";
import { MULTI_DAY_MARKERS } from "./rules.data";
import type { IntentDateRange, ResolvedIntent } from "./types";

export const DEFAULT_PLAN_DAYS = 7;
export const DEFAULT_PACKING_DAYS = 3;

export function hasMultiDayMarker(text: string) {
  return MULTI_DAY_MARKERS.some((pattern) => pattern.test(text));
}

/**
 * A "planning" request that covers a single day is really an outfit request
 * ("plan a dinner outfit", "plan what I wear tomorrow"), so it is routed to
 * the outfit path rather than spending a planner call on one look.
 */
export function collapseSingleDayPlanning(resolved: ResolvedIntent): ResolvedIntent {
  if (resolved.intent !== "planning") return resolved;
  const dayCount = resolved.range?.dayCount ?? (hasMultiDayMarker(resolved.text) ? 2 : 1);
  return dayCount > 1 ? resolved : { ...resolved, intent: "outfit_request" };
}

/** The window a multi-day handler should actually cover. */
export function resolvePlanWindow(
  resolved: ResolvedIntent,
  baseDate: string,
  fallbackDays: number,
): IntentDateRange {
  return (
    resolved.range ?? buildIntentRange(baseDate, fallbackDays, `the next ${fallbackDays} days`)
  );
}
