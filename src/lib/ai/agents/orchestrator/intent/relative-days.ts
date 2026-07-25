import { buildIntentRange } from "./build-range";
import { addDays, weekdayIndex } from "./date-utils";
import { WEEKDAY_NAMES } from "./rules.data";
import type { IntentDateRange } from "./types";

/** "today", "tomorrow", "the day after tomorrow", or a named weekday. */
export function relativeDayRange(text: string, baseDate: string): IntentDateRange | null {
  if (/\bday after tomorrow\b/.test(text)) {
    return buildIntentRange(addDays(baseDate, 2), 1, "the day after tomorrow");
  }
  if (/\btomorrow\b/.test(text)) return buildIntentRange(addDays(baseDate, 1), 1, "tomorrow");
  if (/\b(?:today|tonight|this (?:morning|afternoon|evening))\b/.test(text)) {
    return buildIntentRange(baseDate, 1, "today");
  }

  for (const [index, name] of WEEKDAY_NAMES.entries()) {
    if (!new RegExp(`\\b${name}\\b`).test(text)) continue;
    const offset = (index - weekdayIndex(baseDate) + 7) % 7;
    const isNext = /\bnext\b/.test(text);
    return buildIntentRange(addDays(baseDate, offset === 0 && isNext ? 7 : offset), 1, name);
  }
  return null;
}
