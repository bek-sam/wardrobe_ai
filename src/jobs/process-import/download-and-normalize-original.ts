import type { SupabaseClient } from "@supabase/supabase-js";

import { validateAndNormalizeImage } from "@/lib/image/validation";
import { downloadPrivateObject, uploadPrivateObject } from "@/lib/storage/private-images";

import type { ImportJobRow } from "./types";

export async function downloadAndNormalizeOriginal(admin: SupabaseClient, job: ImportJobRow) {
  const original = await downloadPrivateObject(
    admin,
    job.original_image_bucket,
    job.original_image_path,
    job.user_id,
  );
  const normalized = await validateAndNormalizeImage(original);
  await uploadPrivateObject(
    admin,
    job.original_image_bucket,
    job.original_image_path,
    job.user_id,
    normalized.bytes,
    normalized.mimeType,
  );
  return normalized;
}
