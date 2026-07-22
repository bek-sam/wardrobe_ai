import { itemParamsSchema } from "@/app/api/_lib/schemas";
import { parseRouteParams, throwDatabaseError, throwNotFound } from "@/app/api/_lib/route";
import { wardrobeItemUpdateSchema } from "@/features/wardrobe/schemas";
import { withSignedWardrobeImages } from "@/features/wardrobe/server/item-view";
import { ok, parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ itemId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const viewer = await requireViewer();
    const { itemId } = await parseRouteParams(context.params, itemParamsSchema);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("wardrobe_items")
      .select("*, wardrobe_item_images(*)")
      .eq("id", itemId)
      .eq("user_id", viewer.id)
      .is("deleted_at", null)
      .maybeSingle();
    throwDatabaseError(error, "Could not load the wardrobe item.");
    if (!data) throwNotFound("Wardrobe item");
    return ok(await withSignedWardrobeImages(supabase, viewer.id, data), {
      headers: { "Cache-Control": "no-store" },
    });
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
    const { data, error } = await supabase
      .from("wardrobe_items")
      .update(input)
      .eq("id", itemId)
      .eq("user_id", viewer.id)
      .is("deleted_at", null)
      .select()
      .maybeSingle();
    throwDatabaseError(error, "Could not update the wardrobe item.");
    if (!data) throwNotFound("Wardrobe item");
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
    const { data, error } = await supabase
      .from("wardrobe_items")
      .delete()
      .eq("id", itemId)
      .eq("user_id", viewer.id)
      .select("id")
      .maybeSingle();
    throwDatabaseError(error, "Could not delete the wardrobe item.");
    if (!data) throwNotFound("Wardrobe item");
    return ok({ deleted: true, id: itemId });
  } catch (error) {
    return routeError(error);
  }
}
