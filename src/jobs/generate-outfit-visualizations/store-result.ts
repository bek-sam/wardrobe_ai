import { randomUUID } from "node:crypto";

import type { GeneratedVisualizationImage } from "@/lib/ai/visualization-provider";
import { getServerEnvironment } from "@/lib/env/server";
import { uploadPrivateObject } from "@/lib/storage/private-images";
import type { GarmentHotspot, VisualizationAssessment } from "@/lib/visualization";

import type { AdminClient, VisualizationJobRow } from "./types";

/** Safe QA summary only: verdicts and one short sentence, never image bytes. */
function safeQaSummary(assessment: VisualizationAssessment, correctionUsed: boolean) {
  return {
    verdict: assessment.verdict,
    identity: assessment.identity.recognizableMatch,
    framing: assessment.framing,
    anatomy: assessment.anatomy.verdict,
    garments: assessment.garments.map(({ itemId, role, present }) => ({ itemId, role, present })),
    extraGarmentCount: assessment.extraGarments.length,
    correctionUsed,
    summary: assessment.safeSummary,
  };
}

export async function storeVisualizationResult(
  admin: AdminClient,
  job: VisualizationJobRow,
  result: {
    image: GeneratedVisualizationImage;
    assessment: VisualizationAssessment;
    correctionUsed: boolean;
    hotspots: readonly GarmentHotspot[];
  },
) {
  const bucket = getServerEnvironment().WARDROBE_GENERATED_BUCKET;
  const path = `${job.user_id}/visualizations/${job.visualization_id}/${randomUUID()}.png`;
  await uploadPrivateObject(admin, bucket, path, job.user_id, result.image.bytes, "image/png");

  if (result.correctionUsed) {
    await admin.rpc("record_visualization_correction", {
      p_visualization_id: job.visualization_id,
      p_user_id: job.user_id,
    });
  }

  const { error } = await admin.rpc("finalize_outfit_visualization", {
    p_job_id: job.id,
    p_user_id: job.user_id,
    p_bucket: bucket,
    p_storage_path: path,
    p_output_sha256: result.image.sha256,
    p_qa_summary: safeQaSummary(result.assessment, result.correctionUsed),
    p_hotspots: result.hotspots,
    p_request_id: result.image.requestId,
  });
  if (error) throw error;
}
