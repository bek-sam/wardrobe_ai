import { NextResponse } from "next/server";

import { generatePlanSchema } from "@/features/planner/schemas";
import { parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import { buildPlannerDays, runPlannerAgent } from "@/lib/ai/agents/planner-agent";
import { getPreferences } from "@/lib/ai/tools/get-preferences";
import { getServerEnvironment } from "@/lib/env/server";
import { enforceAiUsageLimits } from "@/lib/usage/limits";
import type { WardrobeItem } from "@/features/wardrobe";
import type { PlannerDay } from "@/lib/ai/agents/planner-agent";
import type { PlannerResult } from "@/lib/ai/schemas";
import { resolveWardrobeItemRole } from "@/lib/recommendation";

type GeneratePlanInput = z.infer<typeof generatePlanSchema>;

function buildPlanRows(
  looks: PlannerResult["looks"],
  plannerDays: readonly PlannerDay[],
  candidateMap: ReadonlyMap<string, WardrobeItem>,
) {
  return looks.map((look) => {
    const day = plannerDays.find((candidate) => candidate.date === look.date);
    const items = look.itemIds.map((itemId, index) => {
      const item = candidateMap.get(itemId);
      const role = item ? resolveWardrobeItemRole(item) : null;
      if (!role) throw new Error("A planned item has no valid role.");
      return { item_id: itemId, role, sort_order: index };
    });
    return {
      date: look.date,
      occasion: day?.occasion ?? null,
      weather_context: day?.weather ?? {},
      name: look.title,
      explanation: look.explanation,
      confidence: look.confidence,
      items,
    };
  });
}

async function handleGeneratePlan(
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

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const [viewer, input, supabase] = await Promise.all([
      requireViewer(),
      parseJson(request, generatePlanSchema),
      createClient(),
    ]);

    const data = await handleGeneratePlan(supabase, viewer.id, input);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
