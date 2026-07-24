import { extractGarment } from "@/lib/ai/image-service";
import { getServerEnvironment } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { downloadPrivateObject } from "@/lib/storage/private-images";

import { buildExtractionMetadata } from "./build-extraction-metadata";
import { storeExtractionResults } from "./store-extraction-results";
import type { ImportCandidateRow } from "./types";

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
