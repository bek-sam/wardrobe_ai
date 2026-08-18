import { parseRouteParams } from "@/app/api/_lib/route";
import { visualizationParamsSchema } from "@/app/api/_lib/schemas";
import { routeError } from "@/lib/api/response";
import { requireViewer } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { labelVisualizationDownload } from "@/lib/visualization-pipeline";
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
async function loadOwnedVisualizationAsset(
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

export const runtime = "nodejs";

type Context = { params: Promise<{ visualizationId: string }> };

/**
 * Streams the bytes through this authenticated route rather than handing out a
 * URL, and burns the AI-preview label into the file on the way out. No
 * permanent or public URL is ever produced.
 */
export async function GET(_request: Request, context: Context) {
  try {
    const viewer = await requireViewer();
    const { visualizationId } = await parseRouteParams(context.params, visualizationParamsSchema);
    const supabase = await createClient();

    const bytes = await loadOwnedVisualizationAsset(supabase, viewer.id, visualizationId);
    const labeled = await labelVisualizationDownload(bytes);

    return new Response(new Uint8Array(labeled), {
      headers: {
        "Content-Type": "image/png",
        "Content-Length": String(labeled.byteLength),
        "Content-Disposition": `attachment; filename="wardrobe-try-on-${visualizationId}.png"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return routeError(error);
  }
}
