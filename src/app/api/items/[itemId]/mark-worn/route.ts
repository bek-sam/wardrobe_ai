import { itemParamsSchema, markItemWornSchema } from "@/app/api/_lib/schemas";
import {
  parseRouteParams,
  resolveIdempotencyKey,
  throwDatabaseError,
  throwNotFound,
} from "@/app/api/_lib/route";
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
    const input = await parseJson(request, markItemWornSchema);
    const idempotencyKey = resolveIdempotencyKey(request, input.idempotency_key);
    const supabase = await createClient();
    const { data: item, error: itemError } = await supabase
      .from("wardrobe_items")
      .select("id")
      .eq("id", itemId)
      .eq("user_id", viewer.id)
      .is("deleted_at", null)
      .maybeSingle();
    throwDatabaseError(itemError, "Could not verify the wardrobe item.");
    if (!item) throwNotFound("Wardrobe item");

    const { data: wearLogId, error } = await supabase.rpc("mark_wardrobe_item_worn", {
      p_item_id: itemId,
      p_worn_at: input.worn_at ?? new Date().toISOString(),
      p_notes: input.notes ?? null,
      p_idempotency_key: idempotencyKey,
    });
    throwDatabaseError(error, "Could not mark the wardrobe item as worn.");
    return ok({ wear_log_id: wearLogId });
  } catch (error) {
    return routeError(error);
  }
}
