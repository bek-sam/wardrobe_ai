import { NextResponse } from "next/server";
import { regenerateCutoutSchema } from "@/features/intake/schemas/import-job";
import { ApiError, parseJson, routeError } from "@/lib/api/response";
import { requireViewer } from "@/lib/auth/viewer";
import { getServerEnvironment } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { enforceAiUsageLimits } from "@/lib/usage/limits";

type Context = { params: Promise<{ jobId: string; candidateId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const [{ jobId, candidateId }, viewer, input, supabase] = await Promise.all([
      context.params,
      requireViewer(),
      parseJson(request, regenerateCutoutSchema),
      createClient(),
    ]);
    const admin = createAdminClient();
    const { data: waiting, error: waitingError } = await admin
      .from("import_job_candidates")
      .select("id")
      .eq("id", candidateId)
      .eq("job_id", jobId)
      .eq("user_id", viewer.id)
      .in("status", ["review_cutout", "review_metadata", "failed"])
      .not("crop_storage_path", "is", null)
      .maybeSingle();
    if (waitingError) throw waitingError;
    if (!waiting) {
      throw new ApiError(
        409,
        "invalid_candidate_state",
        "This candidate cannot be regenerated yet.",
      );
    }

    const environment = getServerEnvironment();
    await enforceAiUsageLimits(supabase, {
      feature: "image_generation",
      dailyLimit: environment.DAILY_IMAGE_LIMIT,
      rollingBucket: "image_generation",
      rollingLimit: environment.IMAGE_RATE_LIMIT_PER_MINUTE,
    });
    const { data, error } = await admin
      .from("import_job_candidates")
      .update({
        status: "extracting",
        regeneration_prompt: input.instruction ?? null,
        cleanup_tolerance: input.cleanupTolerance ?? 46,
        error_code: null,
        error_message: null,
      })
      .eq("id", candidateId)
      .eq("job_id", jobId)
      .eq("user_id", viewer.id)
      .in("status", ["review_cutout", "review_metadata", "failed"])
      .not("crop_storage_path", "is", null)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data)
      throw new ApiError(
        409,
        "invalid_candidate_state",
        "This candidate cannot be regenerated yet.",
      );
    return NextResponse.json({ data }, { status: 202 });
  } catch (error) {
    return routeError(error);
  }
}
