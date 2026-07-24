import type { SupabaseClient } from "@supabase/supabase-js";

import { throwDatabaseError } from "@/app/api/_lib/route";
import { ApiError } from "@/lib/api/response";

import { verifySwap } from "./verify-swap";

export async function handleSwapOutfitItem(
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
