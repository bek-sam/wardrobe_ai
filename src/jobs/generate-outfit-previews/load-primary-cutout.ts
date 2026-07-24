import { downloadPrivateObject } from "@/lib/storage/private-images";

import { MissingCutoutError } from "./missing-cutout-error";
import type { AdminClient } from "./types";

export async function loadPrimaryCutout(
  admin: AdminClient,
  userId: string,
  itemId: string,
): Promise<Buffer> {
  const { data } = await admin
    .from("wardrobe_item_images")
    .select("bucket_id, storage_path")
    .eq("user_id", userId)
    .eq("item_id", itemId)
    .eq("kind", "cutout")
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) throw new MissingCutoutError(itemId);
  return downloadPrivateObject(
    admin,
    data.bucket_id as string,
    data.storage_path as string,
    userId,
  );
}
