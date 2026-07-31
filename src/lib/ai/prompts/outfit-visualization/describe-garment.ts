import type { VisualizationGarmentInput } from "@/lib/ai/visualization-provider/types";

const ROLE_LABELS: Record<VisualizationGarmentInput["role"], string> = {
  top: "top",
  bottom: "bottom",
  dress: "dress",
  layer: "outer layer",
  shoes: "shoes",
  accessory: "accessory",
};

/**
 * One line per garment, tying an explicit image number to exactly one role and
 * the confirmed wardrobe facts for that item. Item IDs stay out of the prompt
 * text — the server keeps the imageNumber -> itemId mapping for QA instead.
 */
export function describeGarmentInput(garment: VisualizationGarmentInput): string {
  const colors = garment.colorNames.length
    ? garment.colorNames.join(" and ")
    : "the exact colors shown";
  const pattern =
    garment.pattern && garment.pattern.toLowerCase() !== "solid"
      ? `, ${garment.pattern} pattern`
      : "";
  const fit = garment.fit ? `, ${garment.fit} fit` : "";
  const silhouette = garment.silhouette ? `, ${garment.silhouette} silhouette` : "";
  const materials = garment.materials.length ? `, ${garment.materials.join("/")}` : "";
  return `- Image ${garment.imageNumber} is the ${ROLE_LABELS[garment.role]}: ${colors}${pattern}${fit}${silhouette}${materials}.`;
}
