import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";

import { throwDatabaseError } from "@/app/api/_lib/route";
import type { planListQuerySchema } from "@/app/api/_lib/schemas";

type PlanListFilters = z.infer<typeof planListQuerySchema>;

export async function handleListPlans(
  supabase: SupabaseClient,
  userId: string,
  filters: PlanListFilters,
) {
  let query = supabase
    .from("outfit_plans")
    .select("*, outfits(*)", { count: "exact" })
    .eq("user_id", userId);
  if (filters.from) query = query.gte("planned_date", filters.from);
  if (filters.to) query = query.lte("planned_date", filters.to);
  if (filters.status) query = query.eq("status", filters.status);

  const { data, error, count } = await query
    .order("planned_date", { ascending: true })
    .order("start_time", { ascending: true, nullsFirst: false })
    .range(filters.offset, filters.offset + filters.limit - 1);
  throwDatabaseError(error, "Could not load outfit plans.");

  return { plans: data ?? [], count: count ?? 0, limit: filters.limit, offset: filters.offset };
}
