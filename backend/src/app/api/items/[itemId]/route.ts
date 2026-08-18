import { itemParamsSchema } from "@/app/api/_lib/schemas";
import { parseRouteParams } from "@/app/api/_lib/route";
import { wardrobeItemUpdateSchema } from "@/features/wardrobe/schemas";
import { ok, parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { throwDatabaseError, throwNotFound } from "@/app/api/_lib/route";
import { withSignedWardrobeImages } from "@/features/wardrobe/server/item-view";
import type { z } from "zod";

type WardrobeItemUpdateInput = z.infer<typeof wardrobeItemUpdateSchema>;

async function handleUpdateItem(
  supabase: SupabaseClient,
  userId: string,
  itemId: string,
  input: WardrobeItemUpdateInput,
) {
  const { data, error } = await supabase
    .from("wardrobe_items")
    .update(input)
    .eq("id", itemId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .select()
    .maybeSingle();
  throwDatabaseError(error, "Could not update the wardrobe item.");
  if (!data) throwNotFound("Wardrobe item");
  return data;
}

async function handleGetItem(supabase: SupabaseClient, userId: string, itemId: string) {
  const { data, error } = await supabase
    .from("wardrobe_items")
    .select("*, wardrobe_item_images(*)")
    .eq("id", itemId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();
  throwDatabaseError(error, "Could not load the wardrobe item.");
  if (!data) throwNotFound("Wardrobe item");
  return withSignedWardrobeImages(supabase, userId, data);
}

async function handleDeleteItem(supabase: SupabaseClient, userId: string, itemId: string) {
  const { data, error } = await supabase
    .from("wardrobe_items")
    .delete()
    .eq("id", itemId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();
  throwDatabaseError(error, "Could not delete the wardrobe item.");
  if (!data) throwNotFound("Wardrobe item");
  return { deleted: true, id: itemId };
}

type Context = { params: Promise<{ itemId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const viewer = await requireViewer();
    const { itemId } = await parseRouteParams(context.params, itemParamsSchema);
    const supabase = await createClient();
    const data = await handleGetItem(supabase, viewer.id, itemId);
    return ok(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const viewer = await requireViewer();
    const { itemId } = await parseRouteParams(context.params, itemParamsSchema);
    const input = await parseJson(request, wardrobeItemUpdateSchema);
    const supabase = await createClient();
    const data = await handleUpdateItem(supabase, viewer.id, itemId, input);
    return ok(data);
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const viewer = await requireViewer();
    const { itemId } = await parseRouteParams(context.params, itemParamsSchema);
    const supabase = await createClient();
    const data = await handleDeleteItem(supabase, viewer.id, itemId);
    return ok(data);
  } catch (error) {
    return routeError(error);
  }
}
