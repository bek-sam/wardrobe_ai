import { buildIntentRange } from "./build-range";
import { inclusiveDayCount, isIsoDate } from "./date-utils";
import { NUMBER_WORDS } from "./rules.data";
import type { IntentDateRange } from "./types";

const DAY_COUNT = /\b(\d{1,2}|[a-z]{3,5})[\s-]?(?:day|days|night|nights)\b/;

/** Dates the user spelled out (2026-08-03) or an explicit "for 4 days". */
export function explicitDateRange(text: string, baseDate: string): IntentDateRange | null {
  const dates = [...text.matchAll(/\d{4}-\d{2}-\d{2}/g)]
    .map((match) => match[0])
    .filter(isIsoDate)
    .sort();
  const start = dates[0];
  const end = dates[dates.length - 1];
  if (start && end && start !== end) {
    return buildIntentRange(start, inclusiveDayCount(start, end), `${start} to ${end}`);
  }
  if (start) return buildIntentRange(start, 1, start);

  const counted = DAY_COUNT.exec(text)?.[1];
  if (!counted) return null;
  const dayCount = Number.isNaN(Number(counted)) ? (NUMBER_WORDS[counted] ?? 0) : Number(counted);
  if (dayCount < 1) return null;
  return buildIntentRange(baseDate, dayCount, `${Math.min(dayCount, 7)} days`);
}
