import { wardrobeItemCreateSchema } from "@/features/wardrobe/schemas";
import { withSignedWardrobeImages } from "@/features/wardrobe/server/item-view";
import { ok, parseJson, routeError } from "@/lib/api/response";
import { requireViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

import { itemListQuerySchema } from "../_lib/schemas";
import { parseQuery, throwDatabaseError } from "../_lib/route";

export async function GET(request: Request) {
  try {
    const viewer = await requireViewer();
    const filters = parseQuery(request, itemListQuerySchema);
    const supabase = await createClient();
    let query = supabase
      .from("wardrobe_items")
      .select("*, wardrobe_item_images(*)", { count: "exact" })
      .eq("user_id", viewer.id)
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

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(filters.offset, filters.offset + filters.limit - 1);
    throwDatabaseError(error, "Could not load wardrobe items.");
    const items = await Promise.all(
      (data ?? []).map((item) =>
        withSignedWardrobeImages(supabase, viewer.id, item, { primaryOnly: true }),
      ),
    );
    return ok(
      {
        items,
        count: count ?? 0,
        limit: filters.limit,
        offset: filters.offset,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const viewer = await requireViewer();
    const input = await parseJson(request, wardrobeItemCreateSchema);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("wardrobe_items")
      .insert({ ...input, source: "manual", user_id: viewer.id })
      .select()
      .single();
    throwDatabaseError(error, "Could not create the wardrobe item.");
    return ok(data, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
