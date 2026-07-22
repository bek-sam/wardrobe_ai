import { NextResponse } from "next/server";
import { generatePlanSchema } from "@/features/planner/schemas";
import type { WardrobeItem } from "@/features/wardrobe/types";
import { parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { runPlannerAgent, type PlannerDay } from "@/lib/ai/agents/planner-agent";
import { getPreferences } from "@/lib/ai/tools/get-preferences";
import { getWardrobeCandidates } from "@/lib/ai/tools/get-wardrobe";
import { getWeatherForStyling } from "@/lib/ai/tools/get-weather";
import { requireViewer } from "@/lib/auth/viewer";
import { getServerEnvironment } from "@/lib/env/server";
import { resolveWardrobeItemRole } from "@/lib/recommendation/item-role";
import { createClient } from "@/lib/supabase/server";
import { enforceAiUsageLimits } from "@/lib/usage/limits";

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
    const environment = getServerEnvironment();
    await enforceAiUsageLimits(supabase, {
      feature: "planner_generation",
      dailyLimit: environment.DAILY_PLANNER_LIMIT,
      rollingBucket: "planner_generation",
      rollingLimit: environment.PLANNER_RATE_LIMIT_PER_MINUTE,
    });
    const { profile, style, feedback } = await getPreferences(viewer.id);
    const candidateMap = new Map<string, WardrobeItem>();
    const plannerDays: PlannerDay[] = [];
    for (const day of input.days) {
      let weather: Awaited<ReturnType<typeof getWeatherForStyling>> = null;
      try {
        weather = await getWeatherForStyling({
          date: day.date,
          requestedLocation: day.location,
          profile,
          comfort: { runsCold: style.runs_cold, runsHot: style.runs_hot },
        });
      } catch {
        weather = null;
      }
      const candidates = await getWardrobeCandidates({
        userId: viewer.id,
        weather: weather?.constraints,
        occasionTags: day.occasion ? [day.occasion] : [],
        targetFormality: style.preferred_formality ?? undefined,
        favoriteColors: style.favorite_colors,
        avoidedColors: style.avoided_colors,
        preferredFits: style.preferred_fits,
        likedItemIds: feedback.likedItemIds,
        dislikedItemIds: feedback.dislikedItemIds,
      });
      for (const item of candidates.items) candidateMap.set(item.id, item);
      plannerDays.push({
        date: day.date,
        occasion: day.occasion ?? null,
        weather,
        eligibleItemIds: candidates.items.map((item) => item.id),
      });
    }
    const candidates = [...candidateMap.values()];
    const planned = await runPlannerAgent({
      userId: viewer.id,
      days: plannerDays,
      candidates,
      preferences: { ...style, feedback },
    });
    const saved = [];
    if (input.save) {
      const plans = planned.result.looks.map((look) => {
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
      const { data, error } = await supabase.rpc("save_generated_week", { p_plans: plans });
      if (error) throw error;
      if (!Array.isArray(data) || data.length !== plans.length) {
        throw new Error("The generated week did not save completely.");
      }
      saved.push(...data);
    }
    return NextResponse.json(
      { data: { ...planned.result, saved, responseId: planned.responseId } },
      { status: 201 },
    );
  } catch (error) {
    return routeError(error);
  }
}
