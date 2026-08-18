import type { PackingAnswer } from "..";
import { DEFAULT_PACKING_DAYS, resolvePlanWindow, type ResolvedIntent } from "../intent";
import type { StylistOrchestratorInput } from "..";
import { recordPlanRun } from "./support";
import { runPlanForWindow } from "./support";
import type { PlanDayView } from "..";
import type { IntentDateRange } from "../intent";
import { formatRangeLabel } from "./support";
import { buildPackingEssentials, buildPackingList } from "./support";
import { packingAnswerText } from "./support";

/** Collapses planned days into the distinct items a trip actually needs. */
function summarizePacking(
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

/**
 * A trip is planned as one look per day against the destination's forecast,
 * then collapsed into the distinct items to actually pack.
 */
export async function answerPackingRequest(
  input: StylistOrchestratorInput,
  resolved: ResolvedIntent,
): Promise<PackingAnswer> {
  const startedAt = Date.now();
  const window = resolvePlanWindow(resolved, input.date, DEFAULT_PACKING_DAYS);
  const destination = resolved.destination ?? input.location ?? null;
  const plan = await runPlanForWindow({
    userId: input.userId,
    window,
    location: destination,
    occasion: input.occasion ?? null,
  });
  const { packingList, essentials, answer } = summarizePacking(plan.views, window, destination);
  const generationId = await recordPlanRun({
    userId: input.userId,
    intent: "packing",
    window,
    plan,
    startedAt,
    destination,
  });

  return {
    kind: "packing",
    intent: "packing",
    generationId,
    answer,
    destination,
    startDate: window.startDate,
    endDate: window.endDate,
    dayCount: window.dayCount,
    days: plan.views,
    packingList,
    essentials,
    missingCategories: plan.missingCategories,
  };
}
