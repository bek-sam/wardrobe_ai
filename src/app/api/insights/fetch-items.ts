import type { SupabaseClient } from "@supabase/supabase-js";

import type { InsightItem } from "./types";

export async function fetchInsightItems(
  supabase: SupabaseClient,
  userId: string,
): Promise<InsightItem[]> {
  const { data, error } = await supabase
    .from("wardrobe_items")
    .select(
      "id,name,category,subcategory,layer_role,color_names,season_tags,wear_count,last_worn_at,purchase_price,currency",
    )
    .eq("user_id", userId)
    .eq("status", "active")
    .is("deleted_at", null);
  if (error) throw error;
  return (data ?? []) as InsightItem[];
}
