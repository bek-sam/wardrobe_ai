import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";

import type { generateOutfitRequestSchema } from "@/features/stylist/schemas";
import { runWardrobeOrchestrator } from "@/lib/ai/agents/orchestrator";
import { getServerEnvironment } from "@/lib/env/server";
import { enforceAiUsageLimits } from "@/lib/usage/limits";

type GenerateOutfitInput = z.infer<typeof generateOutfitRequestSchema>;

export async function handleGenerateOutfit(
  supabase: SupabaseClient,
  userId: string,
  input: GenerateOutfitInput,
) {
  const environment = getServerEnvironment();
  await enforceAiUsageLimits(supabase, {
    feature: "stylist_generation",
    dailyLimit: environment.DAILY_STYLIST_LIMIT,
    rollingBucket: "stylist_generation",
    rollingLimit: environment.STYLIST_RATE_LIMIT_PER_MINUTE,
  });

  const result = await runWardrobeOrchestrator({
    userId,
    request: input.message,
    date: input.date,
    location: input.location,
    occasion: input.occasion,
    targetFormality: input.targetFormality,
    indoorOutdoor: input.indoorOutdoor,
  });

  let savedOutfit: unknown = null;
  if (input.save) {
    if (!result.generationId) {
      throw new Error("The generated outfit could not be recorded for safe saving.");
    }
    const { data, error } = await supabase.rpc("save_recorded_generated_outfit", {
      p_generation_id: result.generationId,
    });
    if (error) throw error;
    savedOutfit = data;
  }

  return { ...result, savedOutfit };
}
