import type { OutfitItemRole } from "@/features/outfits/types";

import type { VisualizationAssessment } from "./schemas";

export const QA_FOUNDATION_ROLES: readonly OutfitItemRole[] = ["top", "bottom", "dress"];

/**
 * Accessories may render loosely without failing the gate; a foundation
 * garment may not. An invented accessory is still caught separately through
 * `extraGarments`, so loose thresholds here never allow a made-up item.
 */
const PRIMARY_FIDELITY_KEYS = [
  "colorFidelity",
  "patternFidelity",
  "silhouetteFidelity",
  "constructionFidelity",
  "closureFidelity",
] as const;

export function garmentQaFailures(assessment: VisualizationAssessment): string[] {
  const reasons: string[] = [];
  for (const garment of assessment.garments) {
    if (!garment.present) {
      reasons.push(`The ${garment.role} is missing from the image.`);
      continue;
    }
    if (!QA_FOUNDATION_ROLES.includes(garment.role)) continue;
    if (PRIMARY_FIDELITY_KEYS.some((key) => garment[key] === "fail")) {
      reasons.push(`The ${garment.role} was not rendered faithfully.`);
    }
  }
  return reasons;
}
