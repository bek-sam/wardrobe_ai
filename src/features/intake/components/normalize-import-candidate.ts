import { isObject, safeNullableString } from "@/lib/api/normalize";

import { candidateStatuses } from "./import-workspace-constants.data";
import { safeInteger, safeSignedUrl } from "./import-normalize-primitives";
import { normalizeBoundingBox, normalizeMetadata } from "./normalize-candidate-metadata";
import type { CandidateStatus, CandidateView } from "./import-workspace.types";

export function normalizeCandidate(value: unknown, index: number): CandidateView | null {
  if (!isObject(value) || typeof value.id !== "string") return null;
  const status = candidateStatuses.has(value.status as CandidateStatus)
    ? (value.status as CandidateStatus)
    : "failed";
  const confidence = isObject(value.field_confidence)
    ? Object.fromEntries(
        Object.entries(value.field_confidence).filter(
          (entry): entry is [string, number] =>
            typeof entry[1] === "number" && entry[1] >= 0 && entry[1] <= 1,
        ),
      )
    : {};
  return {
    id: value.id,
    ordinal: safeInteger(value.ordinal, index, 0, 99),
    status,
    boundingBox: normalizeBoundingBox(value.bounding_box),
    metadata: normalizeMetadata(value.proposed_metadata, value.confirmed_metadata),
    fieldConfidence: confidence,
    cropUrl: safeSignedUrl(value.cropUrl),
    cutoutUrl: safeSignedUrl(value.cutoutUrl),
    failedCutoutUrl: safeSignedUrl(value.failedCutoutUrl),
    modeledUrl: safeSignedUrl(value.modeledUrl),
    errorMessage: safeNullableString(value.error_message),
    cleanupTolerance: safeInteger(value.cleanup_tolerance, 46, 18, 110),
  };
}
