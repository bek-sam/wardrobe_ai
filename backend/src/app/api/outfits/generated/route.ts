import type { SupabaseClient } from "@supabase/supabase-js";

import { generatedOutfitSchema } from "@/features/outfits/schemas";
import { saveGeneratedOutfitRequestSchema } from "@/features/stylist";
import { ApiError, ok, parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

type JsonObject = Record<string, unknown>;

function objectValue(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : null;
}

async function handleSaveGeneratedOutfit(
  supabase: SupabaseClient,
  userId: string,
  generationId: string,
) {
  const { data: run, error: runError } = await supabase
    .from("agent_runs")
    .select("id, agent_type, status, output_summary")
    .eq("id", generationId)
    .eq("user_id", userId)
    .eq("agent_type", "wardrobe_orchestrator")
    .eq("status", "complete")
    .maybeSingle();
  if (runError) throw runError;
  if (!run) throw new ApiError(404, "generation_not_found", "The generated outfit was not found.");

  const output = objectValue(run.output_summary);
  const parsedOutfit = generatedOutfitSchema.safeParse(output?.outfit);
  if (!parsedOutfit.success) {
    throw new ApiError(
      409,
      "generation_invalid",
      "The generated outfit can no longer be saved safely.",
    );
  }

  const { data: savedId, error: saveError } = await supabase.rpc("save_recorded_generated_outfit", {
    p_generation_id: generationId,
  });
  if (saveError || typeof savedId !== "string") {
    throw saveError ?? new Error("Generated outfit save failed.");
  }

  return { id: savedId, source: "ai" as const };
}

export async function POST(request: Request) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const [viewer, input, supabase] = await Promise.all([
      requireViewer(),
      parseJson(request, saveGeneratedOutfitRequestSchema),
      createClient(),
    ]);

    const data = await handleSaveGeneratedOutfit(supabase, viewer.id, input.generationId);
    return ok(data, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
