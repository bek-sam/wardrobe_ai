import { buildPlannerDays, runPlannerAgent } from "@/lib/ai/agents/planner-agent";
import { getPreferences } from "@/lib/ai/tools/get-preferences";

import { addDays, type IntentDateRange } from "../intent";
import { requirePlannerModel } from "../require-model";
import { buildPlanDayViews } from "./plan-view";

type PlanWindowInput = {
  userId: string;
  window: IntentDateRange;
  location: string | null;
  occasion: string | null;
};

/**
 * Shared multi-day pipeline for the planning and packing routes: one planner
 * call over per-day weather and per-day eligible candidates.
 *
 * Quota is deliberately NOT charged here. This is not the authenticated
 * request boundary; both callers arrive from a boundary that has already
 * consumed exactly one planner unit for the resolved intent, so charging again
 * here would double-bill the same request.
 */
export async function runPlanForWindow(input: PlanWindowInput) {
  const environment = requirePlannerModel();
  const preferences = await getPreferences(input.userId);
  const days = Array.from({ length: input.window.dayCount }, (_unused, index) => ({
    date: addDays(input.window.startDate, index),
    location: input.location,
    occasion: input.occasion,
  }));
  const { candidateMap, plannerDays } = await buildPlannerDays(input.userId, days, preferences);
  const planned = await runPlannerAgent({
    userId: input.userId,
    days: plannerDays,
    candidates: [...candidateMap.values()],
    preferences: { ...preferences.style, feedback: preferences.feedback },
  });

  return {
    views: buildPlanDayViews(planned.result.looks, plannerDays, candidateMap),
    missingCategories: planned.result.missingCategories,
    responseId: planned.responseId,
    usage: planned.usage ?? {},
    model: environment.OPENAI_PLANNER_MODEL,
  };
}
