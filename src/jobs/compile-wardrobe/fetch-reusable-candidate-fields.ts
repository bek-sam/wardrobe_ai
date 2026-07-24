import { REUSABLE_CANDIDATE_COLUMNS } from "./reusable-candidate-columns.data";
import type { AdminClient, ReusableCandidateFields, ReusableCandidateRow } from "./types";

export async function fetchReusableCandidateFields(
  admin: AdminClient,
  userId: string,
  previousVersion: string,
  unaffectedKeys: readonly string[],
): Promise<Map<string, ReusableCandidateFields>> {
  const reusableByCombinationKey = new Map<string, ReusableCandidateFields>();
  if (unaffectedKeys.length === 0) return reusableByCombinationKey;

  const { data: previousRows } = await admin
    .from("outfit_candidates")
    .select(REUSABLE_CANDIDATE_COLUMNS)
    .eq("user_id", userId)
    .eq("status", "active")
    .eq("compiled_wardrobe_version", previousVersion)
    .in("combination_key", unaffectedKeys);
  for (const row of (previousRows ?? []) as unknown as ReusableCandidateRow[]) {
    reusableByCombinationKey.set(row.combination_key, {
      curator_status: row.curator_status,
      curator_rejection_reason: row.curator_rejection_reason,
      curator_confidence: row.curator_confidence,
      curator_rank: row.curator_rank,
      curator_model: row.curator_model,
      curator_prompt_version: row.curator_prompt_version,
      curator_reviewed_at: row.curator_reviewed_at,
      style_tags: row.style_tags,
      preview_status: row.preview_status,
      preview_bucket: row.preview_bucket,
      preview_storage_path: row.preview_storage_path,
      preview_source_hash: row.preview_source_hash,
      preview_model: row.preview_model,
      preview_generated_at: row.preview_generated_at,
      preview_error_code: row.preview_error_code,
      times_suggested: row.times_suggested,
      last_suggested_at: row.last_suggested_at,
    });
  }
  return reusableByCombinationKey;
}
