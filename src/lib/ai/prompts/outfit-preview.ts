export interface OutfitPreviewPromptItem {
  role: string;
  category: string;
  colorNames: readonly string[];
  pattern: string | null;
}

// Deterministic template: the image generator only ever renders a validated
// stored outfit -- it never selects or changes garments. Item order in the
// listing follows the outfit's own sort order (foundation first).
export function buildOutfitPreviewPrompt(items: readonly OutfitPreviewPromptItem[]): string {
  const listing = items
    .map((item) => {
      const colors = item.colorNames.length ? item.colorNames.join("/") : "unspecified color";
      const pattern =
        item.pattern && item.pattern.toLowerCase() !== "solid" ? `, ${item.pattern} pattern` : "";
      return `- ${item.role}: ${colors} ${item.category}${pattern}`;
    })
    .join("\n");

  return `Dress the person shown in the identity reference photo in exactly these garments,
preserving their face, body proportions, and pose. Do not add, remove, or
substitute any item, and do not alter their identity in any way:
${listing}

Neutral studio background, natural even lighting, full-body framing, realistic
fit and drape. This is a private styling preview, not a final photograph.`;
}
