// Fields carried forward from an unaffected candidate's row in the
// previously published version, so previews/curator analysis survive an
// unrelated wardrobe edit instead of resetting to not_reviewed/none every
// compile.
export const REUSABLE_CANDIDATE_COLUMNS =
  "combination_key, curator_status, curator_rejection_reason, curator_confidence, curator_rank, " +
  "curator_model, curator_prompt_version, curator_reviewed_at, style_tags, preview_status, " +
  "preview_bucket, preview_storage_path, preview_source_hash, preview_model, preview_generated_at, " +
  "preview_error_code, times_suggested, last_suggested_at";
