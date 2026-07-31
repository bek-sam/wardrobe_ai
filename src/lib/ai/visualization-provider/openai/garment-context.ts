import type { VisualizationGarmentInput } from "../types";

/**
 * The exact catalog record the assessor compares the rendered image against.
 * Item IDs are included so the returned per-garment verdicts map back to owned
 * rows — this is server-side context, never user-visible prompt text.
 */
export function garmentAssessmentContext(garments: readonly VisualizationGarmentInput[]) {
  return garments.map((garment) => ({
    itemId: garment.itemId,
    role: garment.role,
    imageNumber: garment.imageNumber,
    name: garment.name,
    colorNames: garment.colorNames,
    pattern: garment.pattern,
    fit: garment.fit,
    silhouette: garment.silhouette,
    materials: garment.materials,
  }));
}

export function dataUrl(bytes: Buffer): string {
  return `data:image/png;base64,${bytes.toString("base64")}`;
}
