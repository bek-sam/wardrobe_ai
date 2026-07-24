import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";

import type { itemListQuerySchema } from "../_lib/schemas";

type ItemListFilters = z.infer<typeof itemListQuerySchema>;

export function buildFilteredItemsQuery(
  supabase: SupabaseClient,
  userId: string,
  filters: ItemListFilters,
) {
  let query = supabase
    .from("wardrobe_items")
    .select("*, wardrobe_item_images(*)", { count: "exact" })
    .eq("user_id", userId)
    .is("deleted_at", null);

  if (filters.search) query = query.ilike("name", `%${filters.search}%`);
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.brand) query = query.ilike("brand", `%${filters.brand}%`);
  if (filters.color) query = query.contains("color_names", [filters.color]);
  if (filters.season) query = query.contains("season_tags", [filters.season]);
  if (filters.occasion) query = query.contains("occasion_tags", [filters.occasion]);
  if (filters.formality) query = query.eq("formality_level", filters.formality);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.availability) query = query.eq("availability_status", filters.availability);
  if (filters.favorite !== undefined) query = query.eq("favorite", filters.favorite);

  return query;
}
