import { outfitParamsSchema, swapOutfitItemSchema } from "@/app/api/_lib/schemas";
import { parseRouteParams } from "@/app/api/_lib/route";
import { ok, parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { throwDatabaseError } from "@/app/api/_lib/route";
import { ApiError } from "@/lib/api/response";
import { throwNotFound } from "@/app/api/_lib/route";
import { resolveWardrobeItemRole } from "@/lib/recommendation";

async function verifySwap(
  supabase: SupabaseClient,
  userId: string,
  outfitId: string,
  removeItemId: string,
  replacementItemId: string,
) {
  const { data: currentItem, error: currentError } = await supabase
    .from("outfit_items")
    .select("role")
    .eq("outfit_id", outfitId)
    .eq("item_id", removeItemId)
    .eq("user_id", userId)
    .maybeSingle();
  throwDatabaseError(currentError, "Could not verify the outfit item.");
  if (!currentItem) throwNotFound("Outfit item");

  const { data: replacement, error: replacementError } = await supabase
    .from("wardrobe_items")
    .select("id, layer_role, category, subcategory")
    .eq("id", replacementItemId)
    .eq("user_id", userId)
    .eq("status", "active")
    .eq("availability_status", "available")
    .is("deleted_at", null)
    .maybeSingle();
  throwDatabaseError(replacementError, "Could not verify the replacement item.");
  if (!replacement) throwNotFound("Replacement item");
  if (resolveWardrobeItemRole(replacement) !== currentItem.role) {
    throw new ApiError(
      422,
      "invalid_outfit_role",
      "The replacement item must have the same outfit role.",
    );
  }
}

async function handleSwapOutfitItem(
  supabase: SupabaseClient,
  userId: string,
  outfitId: string,
  removeItemId: string,
  replacementItemId: string,
) {
  await verifySwap(supabase, userId, outfitId, removeItemId, replacementItemId);

  const { data, error } = await supabase.rpc("swap_outfit_item", {
    p_outfit_id: outfitId,
    p_remove_item_id: removeItemId,
    p_replacement_item_id: replacementItemId,
  });
  if (error && error.code === "PGRST202") {
    throw new ApiError(
      501,
      "rpc_not_configured",
      "Atomic outfit swaps require the swap_outfit_item database function.",
    );
  }
  throwDatabaseError(error, "Could not swap the outfit item.");
  return data;
}

type Context = { params: Promise<{ outfitId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const viewer = await requireViewer();
    const { outfitId } = await parseRouteParams(context.params, outfitParamsSchema);
    const input = await parseJson(request, swapOutfitItemSchema);
    const supabase = await createClient();

    const data = await handleSwapOutfitItem(
      supabase,
      viewer.id,
      outfitId,
      input.remove_item_id,
      input.replacement_item_id,
    );
    return ok(data);
  } catch (error) {
    return routeError(error);
  }
}
