import type { SupabaseClient } from "@supabase/supabase-js";

import { throwDatabaseError, throwNotFound } from "@/app/api/_lib/route";

export async function handleGetOutfit(supabase: SupabaseClient, userId: string, outfitId: string) {
  const { data, error } = await supabase
    .from("outfits")
    .select("*, outfit_items(*, wardrobe_items(*))")
    .eq("id", outfitId)
    .eq("user_id", userId)
    .maybeSingle();
  throwDatabaseError(error, "Could not load the outfit.");
  if (!data) throwNotFound("Outfit");
  return data;
}
