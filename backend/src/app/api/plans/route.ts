import { planCreateSchema, planListQuerySchema } from "@/app/api/_lib/schemas";
import { parseQuery } from "@/app/api/_lib/route";
import { ok, parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import { throwDatabaseError } from "@/app/api/_lib/route";
import { throwNotFound } from "@/app/api/_lib/route";

type PlanListFilters = z.infer<typeof planListQuerySchema>;

async function handleListPlans(supabase: SupabaseClient, userId: string, filters: PlanListFilters) {
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

type PlanCreateInput = z.infer<typeof planCreateSchema>;

async function handleCreatePlan(supabase: SupabaseClient, userId: string, input: PlanCreateInput) {
  if (input.outfit_id) {
    const { data: outfit, error: outfitError } = await supabase
      .from("outfits")
      .select("id")
      .eq("id", input.outfit_id)
      .eq("user_id", userId)
      .maybeSingle();
    throwDatabaseError(outfitError, "Could not verify the outfit.");
    if (!outfit) throwNotFound("Outfit");
  }

  const { data, error } = await supabase
    .from("outfit_plans")
    .insert({ ...input, user_id: userId })
    .select()
    .single();
  throwDatabaseError(error, "Could not create the outfit plan.");
  return data;
}

export async function GET(request: Request) {
  try {
    const viewer = await requireViewer();
    const filters = parseQuery(request, planListQuerySchema);
    const supabase = await createClient();
    const data = await handleListPlans(supabase, viewer.id, filters);
    return ok(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const viewer = await requireViewer();
    const input = await parseJson(request, planCreateSchema);
    const supabase = await createClient();
    const data = await handleCreatePlan(supabase, viewer.id, input);
    return ok(data, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
