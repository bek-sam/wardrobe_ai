import { buildIntentRange, MAX_INTENT_RANGE_DAYS } from "./build-range";
import { addDays, weekdayIndex } from "./date-utils";
import type { IntentDateRange } from "./types";

const SATURDAY = 6;

function nextWeekday(baseDate: string, targetIndex: number, allowToday: boolean) {
  const offset = (targetIndex - weekdayIndex(baseDate) + 7) % 7;
  return addDays(baseDate, offset === 0 && !allowToday ? 7 : offset);
}

/** "this weekend", "next week", "the rest of this week". */
export function weekRange(text: string, baseDate: string): IntentDateRange | null {
  if (/\b(?:this|the|coming|next|upcoming) weekend\b|\bweekend\b/.test(text)) {
    const isNext = /\bnext weekend\b/.test(text);
    const saturday = nextWeekday(isNext ? addDays(baseDate, 7) : baseDate, SATURDAY, !isNext);
    return buildIntentRange(saturday, 2, isNext ? "next weekend" : "this weekend");
  }
  if (/\b(?:next|coming|following|upcoming) week\b/.test(text)) {
    return buildIntentRange(nextWeekday(baseDate, 1, false), MAX_INTENT_RANGE_DAYS, "next week");
  }
  if (/\b(?:this|the) week\b|\brest of the week\b/.test(text)) {
    const remaining = 7 - weekdayIndex(baseDate) || 7;
    return buildIntentRange(baseDate, remaining, "this week");
  }
  return null;
}
