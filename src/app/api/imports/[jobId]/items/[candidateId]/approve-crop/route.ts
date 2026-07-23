import { NextResponse } from "next/server";
import { ApiError, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/viewer";
import { getServerEnvironment } from "@/lib/env/server";
import { cropDetectedItem } from "@/lib/image/crop";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { downloadPrivateObject, uploadPrivateObject } from "@/lib/storage/private-images";
import { enforceAiUsageLimits } from "@/lib/usage/limits";
import { imageAssetMetadata } from "@/jobs/process-import";

type Context = { params: Promise<{ jobId: string; candidateId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const [{ jobId, candidateId }, viewer, supabase] = await Promise.all([
      context.params,
      requireViewer(),
      createClient(),
    ]);
    const admin = createAdminClient();
    const { data: waiting, error: waitingError } = await admin
      .from("import_job_candidates")
      .select("id, bounding_box, crop_storage_path")
      .eq("id", candidateId)
      .eq("job_id", jobId)
      .eq("user_id", viewer.id)
      .eq("status", "review_crop")
      .maybeSingle();
    if (waitingError) throw waitingError;
    if (!waiting)
      throw new ApiError(409, "invalid_candidate_state", "The crop is not awaiting approval.");
    if (!waiting.crop_storage_path)
      throw new ApiError(409, "invalid_candidate_state", "The crop is missing.");

    const { data: job, error: jobError } = await admin
      .from("import_jobs")
      .select("original_image_bucket, original_image_path")
      .eq("id", jobId)
      .eq("user_id", viewer.id)
      .single();
    if (jobError) throw jobError;

    const environment = getServerEnvironment();
    await enforceAiUsageLimits(supabase, {
      feature: "image_generation",
      dailyLimit: environment.DAILY_IMAGE_LIMIT,
      rollingBucket: "image_generation",
      rollingLimit: environment.IMAGE_RATE_LIMIT_PER_MINUTE,
    });

    // Regenerate crop.png from the normalized original using the current (possibly
    // user-edited) bounding box, so extraction never operates on a stale crop.
    const original = await downloadPrivateObject(
      admin,
      job.original_image_bucket,
      job.original_image_path,
      viewer.id,
    );
    const crop = await cropDetectedItem(original, waiting.bounding_box);
    const cropAssetMetadata = await imageAssetMetadata(crop);
    await uploadPrivateObject(
      admin,
      environment.WARDROBE_ORIGINALS_BUCKET,
      waiting.crop_storage_path,
      viewer.id,
      crop,
      "image/png",
    );

    const { data, error } = await admin
      .from("import_job_candidates")
      .update({
        status: "extracting",
        crop_approved_at: new Date().toISOString(),
        crop_asset_metadata: cropAssetMetadata,
      })
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
