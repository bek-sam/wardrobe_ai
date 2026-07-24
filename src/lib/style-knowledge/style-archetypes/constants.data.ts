export const STYLE_ARCHETYPES = [
  "minimalist",
  "classic",
  "romantic",
  "edgy",
  "bohemian",
  "preppy",
  "streetwear",
  "athleisure",
  "glam",
  "artsy",
] as const;

export type StyleArchetype = (typeof STYLE_ARCHETYPES)[number];

export const ARCHETYPE_GUIDANCE: Readonly<Record<StyleArchetype, string>> = {
  minimalist: "Clean lines, neutral palette, minimal pattern.",
  classic: "Tailored fits, timeless neutrals, minimal trend influence.",
  romantic: "Soft silhouettes, florals, flowing fabrics.",
  edgy: "Dark palette, leather, asymmetry, hardware details.",
  bohemian: "Flowing layers, earthy tones, mixed textures/patterns.",
  preppy: "Structured pieces, collegiate patterns (stripes, argyle), polished color.",
  streetwear: "Oversized fit, graphics, sneakers, casual layering.",
  athleisure: "Performance fabrics worn as everyday dress.",
  glam: "Statement fabrics (satin, sequins), bold color or metallics.",
  artsy: "Unexpected color/pattern combinations, expressive silhouettes.",
};

export const NEUTRALS = new Set([
  "black",
  "white",
  "gray",
  "grey",
  "navy",
  "beige",
  "brown",
  "cream",
  "tan",
]);

export const CONFIDENCE_FLOOR = 0.35;
