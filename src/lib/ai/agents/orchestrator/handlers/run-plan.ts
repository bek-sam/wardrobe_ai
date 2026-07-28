import { buildPlannerDays, runPlannerAgent } from "@/lib/ai/agents/planner-agent";
import { getPreferences } from "@/lib/ai/tools/get-preferences";
import { getServerEnvironment } from "@/lib/env/server";
import { createClient } from "@/lib/supabase/server";
import { enforceAiUsageLimits } from "@/lib/usage/limits";

import { addDays, type IntentDateRange } from "../intent";
import { buildPlanDayViews } from "./plan-view";

type PlanWindowInput = {
  userId: string;
  window: IntentDateRange;
  location: string | null;
  occasion: string | null;
};

/**
 * Shared multi-day pipeline for the planning and packing routes: one planner
 * call over per-day weather and per-day eligible candidates. Planner quota is
 * consumed here because these routes enter through the stylist endpoints,
 * which only charge the stylist budget.
 */
export async function runPlanForWindow(input: PlanWindowInput) {
  const environment = getServerEnvironment();
  const supabase = await createClient();
  await enforceAiUsageLimits(supabase, {
    feature: "planner_generation",
    dailyLimit: environment.DAILY_PLANNER_LIMIT,
    rollingBucket: "planner_generation",
    rollingLimit: environment.PLANNER_RATE_LIMIT_PER_MINUTE,
  });

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
    model: environment.OPENAI_PLANNER_MODEL ?? "unconfigured",
  };
}
