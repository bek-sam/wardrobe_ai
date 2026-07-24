import type { SupabaseClient } from "@supabase/supabase-js";

import { throwDatabaseError, throwNotFound } from "@/app/api/_lib/route";
import { ApiError } from "@/lib/api/response";
import { resolveWardrobeItemRole } from "@/lib/recommendation";

export async function verifySwap(
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
