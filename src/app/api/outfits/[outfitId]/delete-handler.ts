import type { SupabaseClient } from "@supabase/supabase-js";

import { throwDatabaseError, throwNotFound } from "@/app/api/_lib/route";

export async function handleDeleteOutfit(
  supabase: SupabaseClient,
  userId: string,
  outfitId: string,
) {
  const { data, error } = await supabase
    .from("outfits")
    .delete()
    .eq("id", outfitId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();
  throwDatabaseError(error, "Could not delete the outfit.");
  if (!data) throwNotFound("Outfit");
  return { deleted: true, id: outfitId };
}
