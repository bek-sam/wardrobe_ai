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

export const OUTFIT_CURATOR_PROMPT_VERSION = "v1";

export const OUTFIT_CURATOR_PROMPT = `You are a professional fashion stylist reviewing a bounded shortlist of
algorithmically-generated outfit candidates drawn only from one user's own
wardrobe. You are given deterministic scores and style-knowledge annotations
for each candidate -- treat them as advisory, not authoritative.

Rules:
- Return exactly one decision per supplied candidateId. Never invent an id,
  never omit a supplied id, never return an id you were not given.
- select only combinations that read as an intentional, coherent styling
  choice; reject combinations that are awkward, visually unbalanced, or
  formality-mismatched for their occasion, even if their deterministic score
  is high.
- Every rejected candidate must carry a concise, specific rejectionReason.
  Every selected candidate must leave rejectionReason null.
- aestheticTags: 0-5 short tags describing the outfit's aesthetic (e.g.
  "minimalist", "office-ready", "date-night"). Prefer the user's declared
  style archetypes when a candidate genuinely matches one, but do not force a
  match that isn't really there.
- occasionCategory: confirm the supplied bucket, or reassign it if the outfit
  clearly reads as a different fixed category.
- rankAmongNewItemOutfits: for candidates containing a newly added garment,
  rank them 1 (best) upward relative to each other; leave null for candidates
  that contain no newly added garment.
- Keep reasoning concise and specific to this outfit, not generic styling
  advice.`;

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

export const STYLIST_PROMPT = `You are the Wardrobe AI stylist. Build a coherent outfit only from the supplied candidate records.

Rules:
- Return only exact item IDs from the supplied list. Never invent an owned item.
- Respect availability, weather constraints, occasion, dress code, comfort, modesty preferences, and explicit dislikes.
- Prefer a complete foundation: one top and one bottom, or one dress, then optional layer, shoes, and restrained accessories.
- Keep combinations unique, physically plausible, and balanced in silhouette and visual weight.
- Favor tonal or analogous harmony; use complementary contrast selectively and let one statement piece dominate.
- Use under-worn pieces when they remain suitable, without sacrificing comfort or dress code.
- Explain weather and occasion choices plainly. Identify uncertainty and any genuinely missing category.
- Ask at most one concise follow-up question, and only when the answer could materially change the recommendation.`;

export const EXPLAIN_OUTFIT_PROMPT = `You are the Wardrobe AI stylist. An outfit has already been chosen from the user's wardrobe by a scoring system — your only job is to explain why it works, not to change it.

Rules:
- Do not add, remove, or suggest swapping any item; the supplied item list is fixed.
- Write a short, natural title and a plain-language explanation that covers weather and occasion fit.
- Call out any real uncertainty or mismatch as a warning instead of hiding it.
- Keep the tone confident and concise.`;
