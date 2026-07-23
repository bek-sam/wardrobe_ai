import type { createAdminClient } from "@/lib/supabase/admin";

export function queryConfirmedAssets(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  jobId: string,
  itemIds: string[],
) {
  return Promise.all([
    admin
      .from("import_jobs")
      .select("id, user_id, status, original_image_bucket, original_image_path")
      .eq("id", jobId)
      .eq("user_id", userId)
      .maybeSingle(),
    admin
      .from("import_job_candidates")
      .select(
        "id, user_id, job_id, wardrobe_item_id, crop_storage_path, crop_asset_metadata, cutout_storage_path, cutout_asset_metadata, modeled_storage_path, modeled_asset_metadata",
      )
      .eq("job_id", jobId)
      .eq("user_id", userId)
      .in("wardrobe_item_id", itemIds),
    admin.from("wardrobe_items").select("id").eq("user_id", userId).in("id", itemIds),
    admin
      .from("wardrobe_item_images")
      .select("id, user_id, item_id, kind, bucket_id, storage_path")
      .eq("user_id", userId)
      .in("item_id", itemIds)
      .in("kind", ["original", "crop", "cutout", "modeled"]),
  ]);
}
