import type { SupabaseClient } from "@supabase/supabase-js";

import {
  savedGeneratedPlanSchema,
  saveGeneratedPlanRequestSchema,
} from "@/features/planner/schemas";
import { ApiError, ok, parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Saves a plan the stylist chat already produced. The caller supplies only a
 * generation id: the plan days come from the run this server recorded, and the
 * RPC is the only thing that writes, so retries and concurrent clicks converge
 * on the same rows instead of duplicating a week.
 */
async function handleSaveGeneratedPlan(
  supabase: SupabaseClient,
  userId: string,
  generationId: string,
) {
  const { data: run, error: runError } = await supabase
    .from("agent_runs")
    .select("id")
    .eq("id", generationId)
    .eq("user_id", userId)
    .eq("agent_type", "wardrobe_orchestrator")
    .eq("status", "complete")
    .maybeSingle();
  if (runError) throw runError;
  if (!run) throw new ApiError(404, "generation_not_found", "The generated plan was not found.");

  const { data, error } = await supabase.rpc("save_recorded_generated_week", {
    p_generation_id: generationId,
  });
  if (error) {
    throw new ApiError(409, "generation_invalid", "This plan can no longer be saved safely.");
  }

  const parsed = savedGeneratedPlanSchema.safeParse(data);
  if (!parsed.success) throw new Error("The generated plan did not save completely.");

  return {
    generationId,
    saved: true as const,
    plans: parsed.data.map((entry) => ({ planId: entry.plan_id, outfitId: entry.outfit_id })),
  };
}

export async function POST(request: Request) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const [viewer, input, supabase] = await Promise.all([
      requireViewer(),
      parseJson(request, saveGeneratedPlanRequestSchema),
      createClient(),
    ]);

    const data = await handleSaveGeneratedPlan(supabase, viewer.id, input.generationId);
    return ok(data, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
