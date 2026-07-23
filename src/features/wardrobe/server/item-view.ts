import type { SupabaseClient } from "@supabase/supabase-js";

import { getServerEnvironment } from "@/lib/env/server";
import { createPrivateSignedUrl } from "@/lib/storage/private-images";

import type { ImageRow } from "./item-view.types";

export async function withSignedWardrobeImages<T extends { wardrobe_item_images?: ImageRow[] }>(
  client: SupabaseClient,
  userId: string,
  item: T,
  options: { primaryOnly?: boolean } = {},
) {
  const environment = getServerEnvironment();
  const { wardrobe_item_images: rows = [], ...safeItem } = item;
  const selectedRows = options.primaryOnly
    ? [
        rows.find((image) => image.is_primary) ??
          rows.find((image) => image.kind === "cutout") ??
          rows[0],
      ].filter((image): image is ImageRow => Boolean(image))
    : rows;
  const images = (
    await Promise.all(
      selectedRows.map(async ({ bucket_id, storage_path, ...row }) => {
        try {
          const signedUrl = await createPrivateSignedUrl(
            client,
            bucket_id,
            storage_path,
            userId,
            environment.SIGNED_URL_TTL_SECONDS,
          );
          return { ...row, signed_url: signedUrl };
        } catch {
          return null;
        }
      }),
    )
  ).filter((image): image is NonNullable<typeof image> => image !== null);
  const primary =
    images.find((image) => image.is_primary) ??
    images.find((image) => image.kind === "cutout") ??
    images[0] ??
    null;
  return {
    ...safeItem,
    images,
    primary_image_url: primary?.signed_url ?? null,
    signed_url_expires_in: environment.SIGNED_URL_TTL_SECONDS,
  };
}
