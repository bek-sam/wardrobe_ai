import type { ServerEnvironment } from "@/lib/env/server";
import type { ValidatedImage } from "@/lib/image/validation";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export async function insertImageRow(
  admin: AdminClient,
  environment: ServerEnvironment,
  imageId: string,
  userId: string,
  itemId: string,
  path: string,
  normalized: ValidatedImage,
  isPrimary: boolean,
) {
  const row = {
    id: imageId,
    user_id: userId,
    item_id: itemId,
    kind: "original",
    bucket_id: environment.WARDROBE_ITEMS_BUCKET,
    storage_path: path,
    mime_type: normalized.mimeType,
    width: normalized.width,
    height: normalized.height,
    file_size: normalized.bytes.byteLength,
    is_primary: isPrimary,
  };
  const columns = "id, kind, mime_type, width, height, file_size, is_primary, created_at";
  let { data, error } = await admin
    .from("wardrobe_item_images")
    .insert(row)
    .select(columns)
    .single();
  if (error?.code === "23505" && isPrimary) {
    ({ data, error } = await admin
      .from("wardrobe_item_images")
      .insert({ ...row, is_primary: false })
      .select(columns)
      .single());
  }
  return { data, error };
}
