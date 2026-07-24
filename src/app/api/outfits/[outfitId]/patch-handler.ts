import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";

import type { outfitUpdateSchema } from "@/app/api/_lib/schemas";
import { throwDatabaseError, throwNotFound } from "@/app/api/_lib/route";

type OutfitUpdateInput = z.infer<typeof outfitUpdateSchema>;

export async function handleUpdateOutfit(
  supabase: SupabaseClient,
  userId: string,
  outfitId: string,
  input: OutfitUpdateInput,
) {
  const { data, error } = await supabase
    .from("outfits")
    .update(input)
    .eq("id", outfitId)
    .eq("user_id", userId)
    .select()
    .maybeSingle();
  throwDatabaseError(error, "Could not update the outfit.");
  if (!data) throwNotFound("Outfit");
  return data;
}
