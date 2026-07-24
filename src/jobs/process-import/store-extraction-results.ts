import type { SupabaseClient } from "@supabase/supabase-js";

import type { ExtractGarmentResult } from "@/lib/ai/image-service";
import type { ServerEnvironment } from "@/lib/env/server";
import { uploadPrivateObject } from "@/lib/storage/private-images";

import { imageAssetMetadata } from "./image-asset-metadata";
import type { ImportCandidateRow } from "./types";
import { updateCandidateAfterExtraction } from "./update-candidate-after-extraction";

export async function storeExtractionResults(
  admin: SupabaseClient,
  environment: ServerEnvironment,
  candidate: ImportCandidateRow,
  extraction: ExtractGarmentResult,
) {
  const basePath = `${candidate.user_id}/${candidate.job_id}/candidates/${candidate.id}`;
  const rawPath = `${basePath}/cutout-source-${candidate.extraction_attempt_count + 1}.png`;
  const cutoutPath = `${basePath}/cutout-${candidate.extraction_attempt_count + 1}.png`;
  const cutoutAssetMetadata = await imageAssetMetadata(
    extraction.cutout,
    environment.OPENAI_IMAGE_MODEL,
  );
  await Promise.all([
    uploadPrivateObject(
      admin,
      environment.WARDROBE_GENERATED_BUCKET,
      rawPath,
      candidate.user_id,
      extraction.rawSource,
      "image/png",
    ),
    uploadPrivateObject(
      admin,
      environment.WARDROBE_GENERATED_BUCKET,
      cutoutPath,
      candidate.user_id,
      extraction.cutout,
      "image/png",
    ),
  ]);
  await updateCandidateAfterExtraction(
    admin,
    candidate,
    extraction,
    cutoutAssetMetadata,
    rawPath,
    cutoutPath,
  );
}
