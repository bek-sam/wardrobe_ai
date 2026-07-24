import type { SupabaseClient } from "@supabase/supabase-js";

import { generatedOutfitSchema } from "@/features/outfits/schemas";
import { ApiError } from "@/lib/api/response";

import { objectValue } from "./object-value";

export async function handleSaveGeneratedOutfit(
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
