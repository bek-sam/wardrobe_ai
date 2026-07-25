import type { PlanAnswer } from "../answers.types";
import { DEFAULT_PLAN_DAYS, resolvePlanWindow, type ResolvedIntent } from "../intent";
import type { StylistOrchestratorInput } from "../types";
import { formatRangeLabel } from "./format-day";
import { planAnswerText } from "./plan-text";
import { recordPlanRun } from "./record-plan-run";
import { runPlanForWindow } from "./run-plan";

/** One unique owned-item look per day across the window the request names. */
export async function answerPlanningRequest(
  input: StylistOrchestratorInput,
  resolved: ResolvedIntent,
): Promise<PlanAnswer> {
  const startedAt = Date.now();
  const window = resolvePlanWindow(resolved, input.date, DEFAULT_PLAN_DAYS);
  const plan = await runPlanForWindow({
    userId: input.userId,
    window,
    location: input.location ?? null,
    occasion: input.occasion ?? null,
  });
  const generationId = await recordPlanRun({
    userId: input.userId,
    intent: "planning",
    window,
    plan,
    startedAt,
  });

  return {
    kind: "plan",
    intent: "planning",
    generationId,
    answer: planAnswerText(formatRangeLabel(window), plan.views.length, plan.missingCategories),
    startDate: window.startDate,
    endDate: window.endDate,
    dayCount: window.dayCount,
    days: plan.views,
    missingCategories: plan.missingCategories,
    saved: false,
  };
}
