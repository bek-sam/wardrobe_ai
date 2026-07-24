import type { SupabaseClient } from "@supabase/supabase-js";

import type { ExtractGarmentResult } from "@/lib/ai/image-service";

import type { ImportCandidateRow } from "./types";

export async function updateCandidateAfterExtraction(
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
