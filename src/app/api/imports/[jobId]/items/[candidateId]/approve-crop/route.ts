import { NextResponse } from "next/server";
import { ApiError, routeError } from "@/lib/api/response";
import { requireViewer } from "@/lib/auth/viewer";
import { getServerEnvironment } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { enforceAiUsageLimits } from "@/lib/usage/limits";

type Context = { params: Promise<{ jobId: string; candidateId: string }> };

export async function POST(_request: Request, context: Context) {
  try {
    const [{ jobId, candidateId }, viewer, supabase] = await Promise.all([
      context.params,
      requireViewer(),
      createClient(),
    ]);
    const admin = createAdminClient();
    const { data: waiting, error: waitingError } = await admin
      .from("import_job_candidates")
      .select("id")
      .eq("id", candidateId)
      .eq("job_id", jobId)
      .eq("user_id", viewer.id)
      .eq("status", "review_crop")
      .maybeSingle();
    if (waitingError) throw waitingError;
    if (!waiting)
      throw new ApiError(409, "invalid_candidate_state", "The crop is not awaiting approval.");

    const environment = getServerEnvironment();
    await enforceAiUsageLimits(supabase, {
      feature: "image_generation",
      dailyLimit: environment.DAILY_IMAGE_LIMIT,
      rollingBucket: "image_generation",
      rollingLimit: environment.IMAGE_RATE_LIMIT_PER_MINUTE,
    });
    const { data, error } = await admin
      .from("import_job_candidates")
      .update({ status: "extracting", crop_approved_at: new Date().toISOString() })
      .eq("id", candidateId)
      .eq("job_id", jobId)
      .eq("user_id", viewer.id)
      .eq("status", "review_crop")
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data)
      throw new ApiError(409, "invalid_candidate_state", "The crop is not awaiting approval.");
    await admin
      .from("import_jobs")
      .update({ status: "extracting", progress: 45 })
      .eq("id", jobId)
      .eq("user_id", viewer.id);
    return NextResponse.json({ data }, { status: 202 });
  } catch (error) {
    return routeError(error);
  }
}
