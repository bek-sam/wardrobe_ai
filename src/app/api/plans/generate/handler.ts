import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";

import { runPlannerAgent } from "@/lib/ai/agents/planner-agent";
import { getPreferences } from "@/lib/ai/tools/get-preferences";
import { getServerEnvironment } from "@/lib/env/server";
import { enforceAiUsageLimits } from "@/lib/usage/limits";
import type { generatePlanSchema } from "@/features/planner/schemas";

import { buildPlanRows } from "./build-plan-rows";
import { buildPlannerDays } from "./build-planner-days";

type GeneratePlanInput = z.infer<typeof generatePlanSchema>;

export async function handleGeneratePlan(
  supabase: SupabaseClient,
  userId: string,
  input: GeneratePlanInput,
) {
  const environment = getServerEnvironment();
  await enforceAiUsageLimits(supabase, {
    feature: "planner_generation",
    dailyLimit: environment.DAILY_PLANNER_LIMIT,
    rollingBucket: "planner_generation",
    rollingLimit: environment.PLANNER_RATE_LIMIT_PER_MINUTE,
  });

  const preferences = await getPreferences(userId);
  const { candidateMap, plannerDays } = await buildPlannerDays(userId, input.days, preferences);
  const candidates = [...candidateMap.values()];
  const planned = await runPlannerAgent({
    userId,
    days: plannerDays,
    candidates,
    preferences: { ...preferences.style, feedback: preferences.feedback },
  });

  const saved: unknown[] = [];
  if (input.save) {
    const plans = buildPlanRows(planned.result.looks, plannerDays, candidateMap);
    const { data, error } = await supabase.rpc("save_generated_week", { p_plans: plans });
    if (error) throw error;
    if (!Array.isArray(data) || data.length !== plans.length) {
      throw new Error("The generated week did not save completely.");
    }
    saved.push(...data);
  }

  return { ...planned.result, saved, responseId: planned.responseId };
}
