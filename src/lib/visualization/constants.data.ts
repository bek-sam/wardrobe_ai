import type { OutfitItemRole } from "@/features/outfits/types";

/**
 * Every version below is an input to the visualization freshness hash, so
 * bumping any one of them correctly invalidates existing visualizations
 * instead of serving an image produced by older behaviour.
 */
export const OUTFIT_VISUALIZATION_PROMPT_VERSION = "outfit-visualization@v2";
export const VISUALIZATION_QA_SCHEMA_VERSION = "visualization-qa@v1";
export const VISUALIZATION_LOCALIZATION_VERSION = "garment-hotspots@v1";

/** Versioned consent statement specific to AI try-on. */
export const TRYON_CONSENT_VERSION = "tryon@2026-07";

/** Product label that must accompany every generated try-on image. */
export const AI_TRYON_DISCLAIMER =
  "AI Try-On Preview — style visualization, not size or fit prediction.";

export const VISUALIZATION_STATUSES = [
  "needs_identity",
  "needs_consent",
  "queued",
  "validating_inputs",
  "generating",
  "qa_review",
  "localizing",
  "ready",
  "stale",
  "failed_retryable",
  "failed_terminal",
  "blocked",
  "superseded",
] as const;

/**
 * `needs_identity` and `needs_consent` are pre-conditions resolved at the API
 * boundary, never persisted, so the column constraint is the smaller set.
 */
export const VISUALIZATION_ROW_STATUSES = VISUALIZATION_STATUSES.filter(
  (status) => status !== "needs_identity" && status !== "needs_consent",
);

export const VISUALIZATION_SOURCE_KINDS = ["candidate", "outfit", "plan", "composition"] as const;

/**
 * Paint order for overlapping hotspots. Footwear sits low and isolated;
 * accessories sit above outerwear so a scarf stays selectable over a coat.
 */
export const VISUALIZATION_ROLE_Z_INDEX: Record<OutfitItemRole, number> = {
  shoes: 1,
  bottom: 2,
  dress: 3,
  top: 4,
  layer: 5,
  accessory: 6,
};

/** Client polling backoff: 1.5s, then 3s, then 5s, capped at 5s. */
export const TRYON_POLL_INTERVALS_MS = [1_500, 3_000, 5_000] as const;
