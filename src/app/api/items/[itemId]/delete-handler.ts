import type { SupabaseClient } from "@supabase/supabase-js";

import { throwDatabaseError, throwNotFound } from "@/app/api/_lib/route";

export async function handleDeleteItem(supabase: SupabaseClient, userId: string, itemId: string) {
  const { data, error } = await supabase
    .from("wardrobe_items")
    .delete()
    .eq("id", itemId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();
  throwDatabaseError(error, "Could not delete the wardrobe item.");
  if (!data) throwNotFound("Wardrobe item");
  return { deleted: true, id: itemId };
}
