import { addDays } from "./date-utils";
import type { IntentDateRange } from "./types";

/** save_generated_week and the planner route both cap a plan at seven days. */
export const MAX_INTENT_RANGE_DAYS = 7;

export function buildIntentRange(
  startDate: string,
  dayCount: number,
  label: string,
): IntentDateRange {
  const days = Math.min(Math.max(1, Math.trunc(dayCount)), MAX_INTENT_RANGE_DAYS);
  return { startDate, endDate: addDays(startDate, days - 1), dayCount: days, label };
}
