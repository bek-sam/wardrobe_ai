import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import sharp from "sharp";

import type { ExtractGarmentResult } from "@/lib/ai/image-service";
import type { DetectedGarment } from "@/lib/ai/schemas";
import type { ServerEnvironment } from "@/lib/env/server";
import { cropDetectedItem } from "@/lib/image/crop";
import { uploadPrivateObject } from "@/lib/storage/private-images";

export type ImportJobRow = {
  id: string;
  user_id: string;
  status: string;
  original_image_bucket: string;
  original_image_path: string;
  input_metadata: { userHint?: string | null } | null;
  attempt_count: number;
  locked_until: string | null;
};

export type ImportCandidateRow = {
  id: string;
  user_id: string;
  job_id: string;
  status: string;
  crop_storage_path: string | null;
  proposed_metadata: Record<string, unknown>;
  confirmed_metadata: Record<string, unknown>;
  regeneration_prompt: string | null;
  cleanup_tolerance: number;
  extraction_attempt_count: number;
};

export async function imageAssetMetadata(bytes: Buffer, generationModel?: string | null) {
  const metadata = await sharp(bytes).metadata();
  if (!metadata.width || !metadata.height) throw new Error("Generated image metadata is invalid.");
  return {
    mime_type: "image/png",
    width: metadata.width,
    height: metadata.height,
    file_size: bytes.byteLength,
    ...(generationModel ? { generation_model: generationModel } : {}),
  };
}

function stableCandidateId(jobId: string, ordinal: number) {
  const hex = createHash("sha256").update(`${jobId}:${ordinal}`).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export async function buildCandidateItem(
  admin: SupabaseClient,
  job: ImportJobRow,
  originalMimeBucket: string,
  originalBytes: Buffer,
  garment: DetectedGarment,
  ordinal: number,
) {
  const candidateId = stableCandidateId(job.id, ordinal);
  const crop = await cropDetectedItem(originalBytes, garment.boundingBox);
  const cropPath = `${job.user_id}/${job.id}/candidates/${candidateId}/crop.png`;
  const cropAssetMetadata = await imageAssetMetadata(crop);
  await uploadPrivateObject(admin, originalMimeBucket, cropPath, job.user_id, crop, "image/png");
  return {
    id: candidateId,
    user_id: job.user_id,
    job_id: job.id,
    ordinal,
    status: "review_crop",
    bounding_box: garment.boundingBox,
    proposed_metadata: {
      name: garment.suggestedName,
      category: garment.category,
      subcategory: garment.subcategory,
      primary_color_hex: garment.primaryColorHex,
      secondary_color_hex: garment.secondaryColorHex,
      color_names: garment.colorNames,
      pattern: garment.pattern,
      silhouette: garment.silhouette,
      materials: garment.apparentMaterial
        ? { apparent: garment.apparentMaterial, inferred: true }
        : {},
      visible_text: garment.visibleText,
      season_tags: garment.seasonSuggestions,
      occasion_tags: garment.occasionSuggestions,
      notes: "",
    },
    field_confidence: garment.fieldConfidence,
    crop_storage_path: cropPath,
    crop_asset_metadata: cropAssetMetadata,
  };
}

async function updateCandidateAfterExtraction(
  admin: SupabaseClient,
  candidate: ImportCandidateRow,
  extraction: ExtractGarmentResult,
  cutoutAssetMetadata: unknown,
  rawPath: string,
  cutoutPath: string,
) {
  const { error } = await admin
    .from("import_job_candidates")
    .update({
      status: "review_cutout",
      cutout_storage_path: cutoutPath,
      failed_cutout_storage_path: rawPath,
      chroma_key: extraction.chromaKey,
      cleanup_diagnostics: extraction.cleanup,
      cutout_asset_metadata: cutoutAssetMetadata,
      extraction_attempt_count: candidate.extraction_attempt_count + 1,
      error_code: null,
      error_message: null,
    })
    .eq("id", candidate.id)
    .eq("user_id", candidate.user_id)
    .eq("status", "extracting");
  if (error) throw error;
}

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
    environment.AI_IMAGE_POLICY_VERSION,
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
