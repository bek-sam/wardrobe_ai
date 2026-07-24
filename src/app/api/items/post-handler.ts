import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";

import type { wardrobeItemCreateSchema } from "@/features/wardrobe/schemas";

import { throwDatabaseError } from "../_lib/route";

type WardrobeItemCreateInput = z.infer<typeof wardrobeItemCreateSchema>;

export async function handleCreateItem(
  supabase: SupabaseClient,
  userId: string,
  input: WardrobeItemCreateInput,
) {
  const { data, error } = await supabase
    .from("wardrobe_items")
    .insert({ ...input, source: "manual", user_id: userId })
    .select()
    .single();
  throwDatabaseError(error, "Could not create the wardrobe item.");
  return data;
}
