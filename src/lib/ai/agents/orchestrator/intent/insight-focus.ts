import { addDays, monthsBefore, startOfYear } from "./date-utils";
import { NUMBER_WORDS } from "./rules.data";
import type { InsightFocus } from "./types";

const PERIOD = /\b(\d{1,2}|[a-z]{3,5})\s+(month|week)s?\b/;

/** The cut-off before which a wear no longer counts as "recent". */
function resolveUnwornSince(text: string, baseDate: string) {
  if (/\bthis year\b|\ball year\b/.test(text)) return startOfYear(baseDate);
  if (/\bthis month\b/.test(text)) return `${baseDate.slice(0, 7)}-01`;
  const period = PERIOD.exec(text);
  const quantity = period?.[1];
  if (!period || !quantity) return null;
  const amount = Number.isNaN(Number(quantity)) ? (NUMBER_WORDS[quantity] ?? 0) : Number(quantity);
  if (amount < 1) return null;
  return period[2] === "month" ? monthsBefore(baseDate, amount) : addDays(baseDate, -7 * amount);
}

export function resolveInsightSlots(text: string, baseDate: string) {
  const unwornSince = resolveUnwornSince(text, baseDate);
  const focus = ((): InsightFocus => {
    if (/\bcost per wear\b|\bcost-per-wear\b|\bvalue for money\b/.test(text))
      return "cost_per_wear";
    if (/\bnever worn\b|\bunworn\b|\bunused\b|\bnot worn\b|\bhaven'?t worn\b/.test(text)) {
      return "unworn";
    }
    if (/\bhave not worn\b|\bdon'?t wear\b|\bneglected\b|\bunderused\b/.test(text)) return "unworn";
    if (/\bleast worn\b|\brarely\b|\bhardly\b|\bbarely\b/.test(text)) return "least_worn";
    if (/\bmost worn\b|\bwear (?:the )?most\b|\bgo-?to\b/.test(text)) return "most_worn";
    if (/\bgaps?\b|\bmissing\b|\bholes?\b|\bcoverage\b|\bshould i buy\b/.test(text)) return "gaps";
    return unwornSince ? "unworn" : "overview";
  })();
  return { focus, unwornSince };
}
