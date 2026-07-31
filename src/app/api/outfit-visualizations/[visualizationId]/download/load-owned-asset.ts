import type { SupabaseClient } from "@supabase/supabase-js";

import { throwNotFound } from "@/app/api/_lib/route";
import { ApiError } from "@/lib/api/response";
import { getServerEnvironment } from "@/lib/env/server";
import { enforceRollingLimit } from "@/lib/usage/limits";
import { createAdminClient } from "@/lib/supabase/admin";
import { downloadPrivateObject } from "@/lib/storage/private-images";

/**
 * Ownership is checked through the caller's own RLS-bound client first; only
 * then does the service-role client read the bytes. The route proxies those
 * bytes, so it is rate-limited like the other expensive paths rather than
 * being free to loop.
 */
export async function loadOwnedVisualizationAsset(
  supabase: SupabaseClient,
  userId: string,
  visualizationId: string,
): Promise<Buffer> {
  await enforceRollingLimit(supabase, {
    bucket: "visualization_download",
    limit: getServerEnvironment().VISUALIZATION_DOWNLOAD_RATE_LIMIT_PER_MINUTE,
  });

  const { data, error } = await supabase
    .from("outfit_visualizations")
    .select("bucket_id, storage_path")
    .eq("id", visualizationId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) throwNotFound("Try-on");
  if (!data.bucket_id || !data.storage_path) {
    throw new ApiError(409, "not_ready", "This try-on has no image to download yet.");
  }

  return downloadPrivateObject(
    createAdminClient(),
    data.bucket_id as string,
    data.storage_path as string,
    userId,
  );
}
