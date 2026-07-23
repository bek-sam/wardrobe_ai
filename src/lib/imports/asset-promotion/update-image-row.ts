import type { createAdminClient } from "@/lib/supabase/admin";

import type { ImageRow } from "./schemas";
import type { ImportAssetPromotionPlan } from "./types";

export async function updateImageRow(
  admin: ReturnType<typeof createAdminClient>,
  row: ImageRow,
  plan: ImportAssetPromotionPlan,
) {
  if (row.bucket_id === plan.destination.bucket && row.storage_path === plan.destination.path) {
    return false;
  }

  const { data, error } = await admin
    .from("wardrobe_item_images")
    .update({
      bucket_id: plan.destination.bucket,
      storage_path: plan.destination.path,
    })
    .eq("id", row.id)
    .eq("user_id", row.user_id)
    .eq("item_id", row.item_id)
    .eq("bucket_id", row.bucket_id)
    .eq("storage_path", row.storage_path)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (data) return true;

  // A concurrent retry may have completed the exact same promotion.
  const { data: current, error: currentError } = await admin
    .from("wardrobe_item_images")
    .select("bucket_id, storage_path")
    .eq("id", row.id)
    .eq("user_id", row.user_id)
    .eq("item_id", row.item_id)
    .maybeSingle();
  if (currentError) throw currentError;
  if (
    current?.bucket_id === plan.destination.bucket &&
    current.storage_path === plan.destination.path
  ) {
    return false;
  }
  throw new Error("The confirmed image row changed during asset promotion.");
}
