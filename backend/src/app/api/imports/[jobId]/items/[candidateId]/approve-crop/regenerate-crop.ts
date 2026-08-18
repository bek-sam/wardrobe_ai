import type { SupabaseClient } from "@supabase/supabase-js";

import { imageAssetMetadata } from "@/features/intake/server/job-primitives";
import type { ServerEnvironment } from "@/lib/env/server";
import { cropDetectedItem, type NormalizedBoundingBox } from "@/lib/image/crop";
import { downloadPrivateObject, uploadPrivateObject } from "@/lib/storage/private-images";

// Regenerates crop.png from the normalized original using the current
// (possibly user-edited) bounding box, so extraction never operates on a
// stale crop.
export async function regenerateCrop(
  admin: SupabaseClient,
  environment: ServerEnvironment,
  userId: string,
  job: { original_image_bucket: string; original_image_path: string },
  boundingBox: Partial<NormalizedBoundingBox>,
  cropStoragePath: string,
) {
  const original = await downloadPrivateObject(
    admin,
    job.original_image_bucket,
    job.original_image_path,
    userId,
  );
  const crop = await cropDetectedItem(original, boundingBox);
  const cropAssetMetadata = await imageAssetMetadata(crop);
  await uploadPrivateObject(
    admin,
    environment.WARDROBE_ORIGINALS_BUCKET,
    cropStoragePath,
    userId,
    crop,
    "image/png",
  );
  return cropAssetMetadata;
}
