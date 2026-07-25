import type { PackingAnswer } from "../answers.types";
import { DEFAULT_PACKING_DAYS, resolvePlanWindow, type ResolvedIntent } from "../intent";
import type { StylistOrchestratorInput } from "../types";
import { summarizePacking } from "./packing-summary";
import { recordPlanRun } from "./record-plan-run";
import { runPlanForWindow } from "./run-plan";

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
