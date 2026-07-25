import type { PlanDayView } from "../answers.types";
import type { IntentDateRange } from "../intent";
import { formatRangeLabel } from "./format-day";
import { buildPackingEssentials, buildPackingList } from "./packing-list";
import { packingAnswerText } from "./plan-text";

/** Collapses planned days into the distinct items a trip actually needs. */
export function summarizePacking(
  views: readonly PlanDayView[],
  window: IntentDateRange,
  destination: string | null,
) {
  const packingList = buildPackingList(views);
  const essentials = buildPackingEssentials(views);
  return {
    packingList,
    essentials,
    answer: packingAnswerText(
      formatRangeLabel(window),
      window.dayCount,
      destination,
      packingList,
      essentials,
    ),
  };
}
