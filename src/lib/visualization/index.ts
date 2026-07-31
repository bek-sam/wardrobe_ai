export {
  AI_TRYON_DISCLAIMER,
  OUTFIT_VISUALIZATION_PROMPT_VERSION,
  TRYON_CONSENT_VERSION,
  TRYON_POLL_INTERVALS_MS,
  VISUALIZATION_LOCALIZATION_VERSION,
  VISUALIZATION_QA_SCHEMA_VERSION,
  VISUALIZATION_ROLE_Z_INDEX,
  VISUALIZATION_ROW_STATUSES,
  VISUALIZATION_SOURCE_KINDS,
  VISUALIZATION_STATUSES,
} from "./constants.data";
export {
  buildSnapshotHotspots,
  fallbackHotspot,
  HOTSPOT_MIN_CONFIDENCE,
  isUsableHotspot,
} from "./build-hotspots";
export {
  containedImageRect,
  pointToNormalized,
  projectNormalizedRect,
} from "./coordinate-transform";
export { FALLBACK_BODY_ZONES, HOTSPOT_AREA_BOUNDS } from "./fallback-hotspots.data";
// `freshness` is deliberately NOT re-exported here: it imports node:crypto,
// and this barrel is consumed by client components. Server callers import
// "@/lib/visualization/freshness" directly.
export { hotspotArea, hotspotBounds, hotspotContains } from "./hotspot-geometry";
export { evaluateQaGate, type QaGateResult } from "./qa-gate";
export { garmentQaFailures, QA_FOUNDATION_ROLES } from "./qa-garment-failures";
export { resolveHotspotHit, type HotspotHit } from "./resolve-hotspot-hit";
export {
  hasVisualizationImage,
  isVisualizationInFlight,
  isVisualizationRetryable,
  visualizationProgressLabel,
} from "./status";
export {
  activateIdentityReferenceSchema,
  confirmIdentityUploadSchema,
  createVisualizationSchema,
  garmentHotspotSchema,
  identityReferenceAssessmentSchema,
  type IdentityReferenceAssessment,
  visualizationAssessmentSchema,
  visualizationFeedbackReasons,
  visualizationFeedbackSchema,
  visualizationLocalizationSchema,
  visualizationSourceKindSchema,
  visualizationStatusSchema,
  type CreateVisualizationInput,
  type VisualizationAssessment,
  type VisualizationFeedbackInput,
  type VisualizationLocalization,
} from "./schemas";
export type {
  GarmentHotspot,
  HotspotSource,
  NormalizedPoint,
  NormalizedRect,
  PixelRect,
  Size,
  VisualizationFreshnessInput,
  VisualizationRequestResult,
  VisualizationSnapshotItem,
  VisualizationSourceKind,
  VisualizationStatus,
} from "./types";
