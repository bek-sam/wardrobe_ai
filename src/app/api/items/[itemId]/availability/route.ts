import { availabilitySchema, itemParamsSchema } from "@/app/api/_lib/schemas";
import { parseRouteParams, throwDatabaseError, throwNotFound } from "@/app/api/_lib/route";
import { ok, parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ itemId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const viewer = await requireViewer();
    const { itemId } = await parseRouteParams(context.params, itemParamsSchema);
    const input = await parseJson(request, availabilitySchema);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("wardrobe_items")
      .update(input)
      .eq("id", itemId)
      .eq("user_id", viewer.id)
      .is("deleted_at", null)
      .select("id, availability_status")
      .maybeSingle();
    throwDatabaseError(error, "Could not update item availability.");
    if (!data) throwNotFound("Wardrobe item");
    return ok(data);
  } catch (error) {
    return routeError(error);
  }
}
