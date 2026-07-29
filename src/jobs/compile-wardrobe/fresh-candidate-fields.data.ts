import type { ReusableCandidateFields } from "./types";

/**
 * What a candidate carries when no prior version had this combination.
 *
 * These exist because a bulk PostgREST upsert sends one column list for the
 * whole batch: any key present on *some* row is sent as null for the rest. A
 * compile that reuses a few combinations and generates the rest would
 * therefore write null into `style_tags`, `curator_status`, `preview_status`,
 * and `times_suggested` — all `not null` — and fail the whole batch. Spreading
 * these first makes every row carry the same keys, so the batch is uniform and
 * a brand-new candidate lands on the same values the column defaults would
 * have given it.
 *
 * Kept in step with the defaults in 202607210006_wardrobe_compilation.sql and
 * 202607220001_curator_and_previews.sql. `curator_status` and
 * `curator_rejection_reason` must stay consistent with the table's
 * `(curator_status = 'rejected') = (curator_rejection_reason is not null)`
 * constraint.
 */
export const FRESH_CANDIDATE_FIELDS: ReusableCandidateFields = {
  curator_status: "not_reviewed",
  curator_rejection_reason: null,
  curator_confidence: null,
  curator_rank: null,
  curator_model: null,
  curator_prompt_version: null,
  curator_reviewed_at: null,
  style_tags: [],
  preview_status: "none",
  preview_bucket: null,
  preview_storage_path: null,
  preview_source_hash: null,
  preview_model: null,
  preview_generated_at: null,
  preview_error_code: null,
  times_suggested: 0,
  last_suggested_at: null,
};
