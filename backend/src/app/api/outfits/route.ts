import { outfitCreateSchema, outfitListQuerySchema } from "@/app/api/_lib/schemas";
import { parseQuery } from "@/app/api/_lib/route";
import { ok, parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import { throwDatabaseError } from "@/app/api/_lib/route";

type OutfitListFilters = z.infer<typeof outfitListQuerySchema>;

async function handleListOutfits(
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

type OutfitCreateInput = z.infer<typeof outfitCreateSchema>;

async function handleCreateOutfit(supabase: SupabaseClient, input: OutfitCreateInput) {
  const { data, error } = await supabase.rpc("create_user_outfit", {
    p_name: input.name,
    p_occasion: input.occasion,
    p_season_tags: input.season_tags,
    p_weather_context: input.weather_context,
    p_explanation: input.explanation,
    p_confidence: input.confidence,
    p_favorite: input.favorite,
    p_items: input.items,
  });
  throwDatabaseError(error, "Could not create the outfit.");
  return data;
}

export async function GET(request: Request) {
  try {
    const viewer = await requireViewer();
    const filters = parseQuery(request, outfitListQuerySchema);
    const supabase = await createClient();
    const data = await handleListOutfits(supabase, viewer.id, filters);
    return ok(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    await requireViewer();
    const input = await parseJson(request, outfitCreateSchema);
    const supabase = await createClient();
    const data = await handleCreateOutfit(supabase, input);
    return ok(data, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
