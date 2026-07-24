import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";

import { withSignedWardrobeImages } from "@/features/wardrobe/server/item-view";

import { throwDatabaseError } from "../_lib/route";
import type { itemListQuerySchema } from "../_lib/schemas";
import { buildFilteredItemsQuery } from "./apply-filters";

type ItemListFilters = z.infer<typeof itemListQuerySchema>;

export async function handleListItems(
  supabase: SupabaseClient,
  userId: string,
  filters: ItemListFilters,
) {
  const { data, error, count } = await buildFilteredItemsQuery(supabase, userId, filters)
    .order("created_at", { ascending: false })
    .range(filters.offset, filters.offset + filters.limit - 1);
  throwDatabaseError(error, "Could not load wardrobe items.");

  const items = await Promise.all(
    (data ?? []).map((item) =>
      withSignedWardrobeImages(supabase, userId, item, { primaryOnly: true }),
    ),
  );

  return { items, count: count ?? 0, limit: filters.limit, offset: filters.offset };
}
