import type { SupabaseClient } from "@supabase/supabase-js";

import { throwDatabaseError, throwNotFound } from "@/app/api/_lib/route";
import { withSignedWardrobeImages } from "@/features/wardrobe/server/item-view";

export async function handleGetItem(supabase: SupabaseClient, userId: string, itemId: string) {
  const { data, error } = await supabase
    .from("wardrobe_items")
    .select("*, wardrobe_item_images(*)")
    .eq("id", itemId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();
  throwDatabaseError(error, "Could not load the wardrobe item.");
  if (!data) throwNotFound("Wardrobe item");
  return withSignedWardrobeImages(supabase, userId, data);
}
