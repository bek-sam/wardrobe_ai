import { randomUUID } from "node:crypto";

import type { ServerEnvironment } from "@/lib/env/server";
import type { ValidatedImage } from "@/lib/image/validation";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadPrivateObject } from "@/lib/storage/private-images";

import { checkIsFirstImage } from "./check-is-first-image";
import { insertImageRow } from "./insert-image-row";

type AdminClient = ReturnType<typeof createAdminClient>;

export async function persistImageRecord(
  admin: AdminClient,
  environment: ServerEnvironment,
  userId: string,
  itemId: string,
  normalized: ValidatedImage,
) {
  const imageId = randomUUID();
  const path = `${userId}/${itemId}/original/${imageId}.png`;
  await uploadPrivateObject(
    admin,
    environment.WARDROBE_ITEMS_BUCKET,
    path,
    userId,
    normalized.bytes,
    normalized.mimeType,
  );

  const rollback = () => admin.storage.from(environment.WARDROBE_ITEMS_BUCKET).remove([path]);

  const isFirstImage = await checkIsFirstImage(admin, userId, itemId).catch(async (error) => {
    await rollback();
    throw error;
  });

  const { data, error } = await insertImageRow(
    admin,
    environment,
    imageId,
    userId,
    itemId,
    path,
    normalized,
    isFirstImage,
  );
  if (error || !data) {
    await rollback();
    throw error ?? new Error("Image metadata could not be saved.");
  }

  return { data, path };
}
