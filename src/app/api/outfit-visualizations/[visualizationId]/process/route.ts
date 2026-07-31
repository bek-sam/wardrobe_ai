import { NextResponse } from "next/server";

import { parseRouteParams } from "@/app/api/_lib/route";
import { visualizationParamsSchema } from "@/app/api/_lib/schemas";
import { ApiError, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/viewer";
import { getServerEnvironment } from "@/lib/env/server";
import { processOwnedVisualizationJob } from "@/jobs/generate-outfit-visualizations";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

type Context = { params: Promise<{ visualizationId: string }> };

/**
 * Explicitly feature-gated convenience for deployments with no scheduler
 * (local development, E2E with the fake provider). Off by default: a long paid
 * image call does not belong in a normal route-handler lifecycle. The RPC
 * still refuses to claim a job the caller does not own.
 */
export async function POST(request: Request, context: Context) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    if (!getServerEnvironment().VISUALIZATION_INLINE_PROCESSING_ENABLED) {
      throw new ApiError(
        404,
        "not_found",
        "Inline try-on processing is not enabled on this deployment.",
      );
    }

    const [viewer, { visualizationId }, supabase] = await Promise.all([
      requireViewer(),
      parseRouteParams(context.params, visualizationParamsSchema),
      createClient(),
    ]);

    const { data, error } = await supabase.rpc("claim_owned_outfit_visualization_job", {
      p_visualization_id: visualizationId,
      p_lease_seconds: 600,
    });
    if (error) throw error;
    const claimed = Array.isArray(data) ? data[0] : null;
    if (!claimed) {
      throw new ApiError(
        409,
        "not_claimable",
        "This try-on is already processing, not queued, or out of retries.",
      );
    }

    const result = await processOwnedVisualizationJob(claimed.id as string, viewer.id);
    return NextResponse.json({ data: result }, { status: 202 });
  } catch (error) {
    return routeError(error);
  }
}
