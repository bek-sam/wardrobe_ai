import { wardrobeItemCreateSchema } from "@/features/wardrobe/schemas";
import { ok, parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

import { itemListQuerySchema } from "../_lib/schemas";
import { parseQuery } from "../_lib/route";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import { withSignedWardrobeImages } from "@/features/wardrobe/server/item-view";
import { throwDatabaseError } from "../_lib/route";

type ItemListFilters = z.infer<typeof itemListQuerySchema>;

function buildFilteredItemsQuery(
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

type ItemListInput = z.infer<typeof itemListQuerySchema>;

async function handleListItems(supabase: SupabaseClient, userId: string, filters: ItemListInput) {
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

type WardrobeItemCreateInput = z.infer<typeof wardrobeItemCreateSchema>;

async function handleCreateItem(
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

export async function GET(request: Request) {
  try {
    const viewer = await requireViewer();
    const filters = parseQuery(request, itemListQuerySchema);
    const supabase = await createClient();
    const data = await handleListItems(supabase, viewer.id, filters);
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
    const input = await parseJson(request, wardrobeItemCreateSchema);
    const supabase = await createClient();
    const data = await handleCreateItem(supabase, viewer.id, input);
    return ok(data, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
