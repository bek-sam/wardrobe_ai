import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";

import { throwDatabaseError } from "@/app/api/_lib/route";
import type { outfitListQuerySchema } from "@/app/api/_lib/schemas";

type OutfitListFilters = z.infer<typeof outfitListQuerySchema>;

export async function handleListOutfits(
  supabase: SupabaseClient,
  userId: string,
  filters: OutfitListFilters,
) {
  const selection = filters.worn
    ? "*, outfit_items(*), wear_logs!inner(id,worn_at)"
    : "*, outfit_items(*), wear_logs(id,worn_at)";
  let query = supabase.from("outfits").select(selection, { count: "exact" }).eq("user_id", userId);
  if (filters.source) query = query.eq("source", filters.source);
  if (filters.favorite !== undefined) query = query.eq("favorite", filters.favorite);

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(filters.offset, filters.offset + filters.limit - 1);
  throwDatabaseError(error, "Could not load outfits.");

  return { outfits: data ?? [], count: count ?? 0, limit: filters.limit, offset: filters.offset };
}
