import type { SupabaseClient } from "@supabase/supabase-js";

import { cropDetectedItem } from "@/lib/image/crop";
import type { DetectedGarment } from "@/lib/ai/schemas/cataloging";
import { uploadPrivateObject } from "@/lib/storage/private-images";

import { imageAssetMetadata } from "./image-asset-metadata";
import { stableCandidateId } from "./stable-candidate-id";
import type { ImportJobRow } from "./types";

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
