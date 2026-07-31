import { parseRouteParams } from "@/app/api/_lib/route";
import { visualizationParamsSchema } from "@/app/api/_lib/schemas";
import { routeError } from "@/lib/api/response";
import { requireViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { labelVisualizationDownload } from "@/lib/visualization-pipeline/label-download";

import { loadOwnedVisualizationAsset } from "./load-owned-asset";

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
