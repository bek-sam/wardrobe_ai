import { NextResponse } from "next/server";

import { parseRouteParams } from "@/app/api/_lib/route";
import { visualizationParamsSchema } from "@/app/api/_lib/schemas";
import { ApiError, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { TRYON_POLL_INTERVALS_MS } from "@/lib/visualization";
import { normalizeRequestOutcome } from "@/lib/visualization-pipeline";

type Context = { params: Promise<{ visualizationId: string }> };

/**
 * Re-runs the same snapshot rather than minting a new one, so feedback and QA
 * history stay attached to a single row and a "wrong garment" report keeps its
 * target. A regeneration is a new paid call, so it consumes quota again.
 */
export async function POST(request: Request, context: Context) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    await requireViewer();
    const { visualizationId } = await parseRouteParams(context.params, visualizationParamsSchema);
    const supabase = await createClient();

    const { data, error } = await supabase.rpc("regenerate_outfit_visualization", {
      p_visualization_id: visualizationId,
    });
    if (error?.code === "PT429") {
      throw new ApiError(
        429,
        "visualization_rate_limited",
        "You've asked for several try-ons in a row. Wait a moment and try again.",
      );
    }
    if (error?.code === "PT404") throw new ApiError(404, "not_found", "That try-on was not found.");
    if (error) throw error;

    return NextResponse.json(
      { data: { ...normalizeRequestOutcome(data), pollAfterMs: TRYON_POLL_INTERVALS_MS[0] } },
      { status: 202, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return routeError(error);
  }
}
