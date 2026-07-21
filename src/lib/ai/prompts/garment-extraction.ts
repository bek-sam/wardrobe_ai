export type GarmentPromptMetadata = {
  name?: string | null;
  category?: string | null;
  primaryColorHex?: string | null;
  secondaryColorHex?: string | null;
  visibleDetails?: readonly string[];
};

export function buildGarmentExtractionPrompt(
  metadata: GarmentPromptMetadata,
  chromaKey: string,
): string {
  const name = metadata.name || "clothing item";
  const category = metadata.category || "wardrobe item";
  const primary = metadata.primaryColorHex || "the exact visible color";
  const secondary = metadata.secondaryColorHex
    ? ` with distinct secondary color ${metadata.secondaryColorHex}`
    : "";
  const details = metadata.visibleDetails?.length
    ? metadata.visibleDetails.join(", ")
    : "all clearly visible construction and design details";

  return `Use case: background extraction for a private wardrobe catalog.

Reconstruct only the complete empty ${name} (${category}) shown in the reference as a clean, front-facing product photograph. If a wearer is present, remove them. Remove all other garments, objects, and background elements. Show exactly one complete item with no person, body, mannequin, hanger, retail tag, or prop.

Preserve the exact primary color ${primary}${secondary}, visible material texture, silhouette, neckline, sleeves, fastenings, pattern, and distinctive details (${details}). Preserve clearly legible existing graphics or logos exactly. Do not invent or reinterpret uncertain text, logos, pockets, seams, hardware, colors, or decoration.

Center the entire item with even padding and no cropping. Use neutral diffuse product lighting on the garment only. The background must be a perfectly flat, uniform ${chromaKey} chroma-key color edge-to-edge, without shadows, gradient, texture, floor, horizon, reflection, or spill. Do not use ${chromaKey} anywhere in the garment.`;
}
