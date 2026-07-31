import { parseRouteParams } from "@/app/api/_lib/route";
import { visualizationParamsSchema } from "@/app/api/_lib/schemas";
import { ok, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

import { handleGetVisualization } from "./get-handler";

type Context = { params: Promise<{ visualizationId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const viewer = await requireViewer();
    const { visualizationId } = await parseRouteParams(context.params, visualizationParamsSchema);
    const supabase = await createClient();
    const data = await handleGetVisualization(supabase, viewer.id, visualizationId);
    // Contains a short-lived signed URL: it must never be cached anywhere.
    return ok(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    await requireViewer();
    const { visualizationId } = await parseRouteParams(context.params, visualizationParamsSchema);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("delete_outfit_visualization", {
      p_visualization_id: visualizationId,
    });
    if (error) throw error;
    return ok({ deleted: Boolean(data) });
  } catch (error) {
    return routeError(error);
  }
}
