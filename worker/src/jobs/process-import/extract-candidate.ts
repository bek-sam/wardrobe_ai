import { extractGarment } from "@/lib/ai/image-service";
import { getServerEnvironment } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { downloadPrivateObject } from "@/lib/storage/private-images";
import { storeExtractionResults, type ImportCandidateRow } from "./primitives";

function buildExtractionMetadata(candidate: ImportCandidateRow) {
  const metadata = { ...candidate.proposed_metadata, ...candidate.confirmed_metadata };
  return {
    name: typeof metadata.name === "string" ? metadata.name : null,
    category: typeof metadata.category === "string" ? metadata.category : null,
    primaryColorHex:
      typeof metadata.primary_color_hex === "string" ? metadata.primary_color_hex : null,
    secondaryColorHex:
      typeof metadata.secondary_color_hex === "string" ? metadata.secondary_color_hex : null,
    visibleDetails: Array.isArray(metadata.visible_text)
      ? metadata.visible_text.filter((value): value is string => typeof value === "string")
      : [],
  };
}

export async function extractCandidate(candidate: ImportCandidateRow) {
  if (!candidate.crop_storage_path) throw new Error("The approved crop is missing.");
  const admin = createAdminClient();
  const environment = getServerEnvironment();
  const crop = await downloadPrivateObject(
    admin,
    environment.WARDROBE_ORIGINALS_BUCKET,
    candidate.crop_storage_path,
    candidate.user_id,
  );
  const extraction = await extractGarment({
    userId: candidate.user_id,
    crop,
    metadata: buildExtractionMetadata(candidate),
    regenerationInstruction: candidate.regeneration_prompt,
    cleanupTolerance: candidate.cleanup_tolerance,
  });
  await storeExtractionResults(admin, environment, candidate, extraction);
}
