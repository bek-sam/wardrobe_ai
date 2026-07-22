import { outfitParamsSchema, outfitUpdateSchema } from "@/app/api/_lib/schemas";
import { parseRouteParams, throwDatabaseError, throwNotFound } from "@/app/api/_lib/route";
import { ok, parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ outfitId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const viewer = await requireViewer();
    const { outfitId } = await parseRouteParams(context.params, outfitParamsSchema);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("outfits")
      .select("*, outfit_items(*, wardrobe_items(*))")
      .eq("id", outfitId)
      .eq("user_id", viewer.id)
      .maybeSingle();
    throwDatabaseError(error, "Could not load the outfit.");
    if (!data) throwNotFound("Outfit");
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
    const { outfitId } = await parseRouteParams(context.params, outfitParamsSchema);
    const input = await parseJson(request, outfitUpdateSchema);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("outfits")
      .update(input)
      .eq("id", outfitId)
      .eq("user_id", viewer.id)
      .select()
      .maybeSingle();
    throwDatabaseError(error, "Could not update the outfit.");
    if (!data) throwNotFound("Outfit");
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
    const { outfitId } = await parseRouteParams(context.params, outfitParamsSchema);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("outfits")
      .delete()
      .eq("id", outfitId)
      .eq("user_id", viewer.id)
      .select("id")
      .maybeSingle();
    throwDatabaseError(error, "Could not delete the outfit.");
    if (!data) throwNotFound("Outfit");
    return ok({ deleted: true, id: outfitId });
  } catch (error) {
    return routeError(error);
  }
}
