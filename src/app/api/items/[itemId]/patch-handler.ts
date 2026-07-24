import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";

import { throwDatabaseError, throwNotFound } from "@/app/api/_lib/route";
import type { wardrobeItemUpdateSchema } from "@/features/wardrobe/schemas";

type WardrobeItemUpdateInput = z.infer<typeof wardrobeItemUpdateSchema>;

export async function handleUpdateItem(
  supabase: SupabaseClient,
  userId: string,
  itemId: string,
  input: WardrobeItemUpdateInput,
) {
  const { data, error } = await supabase
    .from("wardrobe_items")
    .update(input)
    .eq("id", itemId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .select()
    .maybeSingle();
  throwDatabaseError(error, "Could not update the wardrobe item.");
  if (!data) throwNotFound("Wardrobe item");
  return data;
}
