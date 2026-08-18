import { parseRouteParams } from "@/app/api/_lib/route";
import { visualizationParamsSchema } from "@/app/api/_lib/schemas";
import { ApiError, ok, parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { visualizationFeedbackSchema } from "@/lib/visualization";

type Context = { params: Promise<{ visualizationId: string }> };

/**
 * Strict enum plus a bounded optional comment. No image reference, no pixel
 * data, and no free-form field wide enough to become one.
 */
export async function POST(request: Request, context: Context) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const [, { visualizationId }, input, supabase] = await Promise.all([
      requireViewer(),
      parseRouteParams(context.params, visualizationParamsSchema),
      parseJson(request, visualizationFeedbackSchema),
      createClient(),
    ]);

    const { data, error } = await supabase.rpc("record_visualization_feedback", {
      p_visualization_id: visualizationId,
      p_reason: input.reason,
      p_comment: input.comment,
    });
    if (error?.code === "PT429") {
      throw new ApiError(429, "feedback_rate_limited", "Too much feedback at once. Try later.");
    }
    if (error?.code === "PT404") throw new ApiError(404, "not_found", "That try-on was not found.");
    if (error) throw error;
    return ok(data, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
