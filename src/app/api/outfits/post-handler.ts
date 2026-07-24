import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";

import { throwDatabaseError } from "@/app/api/_lib/route";
import type { outfitCreateSchema } from "@/app/api/_lib/schemas";

type OutfitCreateInput = z.infer<typeof outfitCreateSchema>;

export async function handleCreateOutfit(supabase: SupabaseClient, input: OutfitCreateInput) {
  const { data, error } = await supabase.rpc("create_user_outfit", {
    p_name: input.name,
    p_occasion: input.occasion,
    p_season_tags: input.season_tags,
    p_weather_context: input.weather_context,
    p_explanation: input.explanation,
    p_confidence: input.confidence,
    p_favorite: input.favorite,
    p_items: input.items,
  });
  throwDatabaseError(error, "Could not create the outfit.");
  return data;
}
