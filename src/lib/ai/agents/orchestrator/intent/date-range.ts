import { explicitDateRange } from "./explicit-dates";
import { relativeDayRange } from "./relative-days";
import type { IntentDateRange } from "./types";
import { weekRange } from "./week-range";

/**
 * Resolves the calendar window a request talks about, relative to the date the
 * caller supplied (never the server clock, so a user's own timezone wins).
 * Returns null when the text names no window at all; callers decide the default.
 */
export function resolveRequestDateRange(text: string, baseDate: string): IntentDateRange | null {
  return (
    explicitDateRange(text, baseDate) ??
    weekRange(text, baseDate) ??
    relativeDayRange(text, baseDate)
  );
}
