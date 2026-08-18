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

interface ArchetypeInputItem {
  colorNames: readonly string[];
  pattern: string | null;
  silhouette: string | null;
  category: string;
}

const ARCHETYPE_GUIDANCE: Readonly<Record<StyleArchetype, string>> = {
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

const NEUTRALS = new Set([
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

function textOf(item: ArchetypeInputItem) {
  return `${item.category} ${item.pattern ?? ""} ${item.silhouette ?? ""}`.toLowerCase();
}

function ratio(items: readonly ArchetypeInputItem[], pattern: RegExp) {
  return items.filter((item) => pattern.test(textOf(item))).length / Math.max(1, items.length);
}

function neutralRatio(items: readonly ArchetypeInputItem[]) {
  return (
    items.filter((item) => item.colorNames.every((color) => NEUTRALS.has(color.toLowerCase())))
      .length / Math.max(1, items.length)
  );
}

const scorers: Readonly<Record<StyleArchetype, (items: readonly ArchetypeInputItem[]) => number>> =
  {
    minimalist: (items) => {
      const noPattern = items.every(
        (item) => !item.pattern || item.pattern.toLowerCase() === "solid",
      );
      return neutralRatio(items) * 0.6 + (noPattern ? 0.4 : 0);
    },
    classic: (items) => {
      const tailored = items.filter((item) =>
        /tailor|structured|straight/.test(textOf(item)),
      ).length;
      return (tailored / Math.max(1, items.length)) * 0.5 + neutralRatio(items) * 0.5;
    },
    romantic: (items) => ratio(items, /floral|flow|soft|ruffle|lace/),
    edgy: (items) => {
      const dark = items.filter((item) =>
        item.colorNames.some((color) => ["black", "charcoal"].includes(color.toLowerCase())),
      ).length;
      const hardware = items.filter((item) =>
        /leather|studded|zip|hardware|asymmetric/.test(textOf(item)),
      ).length;
      return (dark + hardware) / (Math.max(1, items.length) * 2);
    },
    bohemian: (items) => ratio(items, /flow|earthy|paisley|fringe|layer/),
    preppy: (items) => ratio(items, /stripe|argyle|collar|polo|blazer/),
    streetwear: (items) => {
      const oversized = items.filter((item) => /oversized|baggy|graphic/.test(textOf(item))).length;
      const sneakers = items.filter((item) => /sneaker/.test(textOf(item))).length;
      return (
        (oversized / Math.max(1, items.length)) * 0.6 + (sneakers / Math.max(1, items.length)) * 0.4
      );
    },
    athleisure: (items) => ratio(items, /athletic|jogger|legging|sneaker|performance/),
    glam: (items) => ratio(items, /satin|sequin|metallic|silk|velvet/),
    artsy: (items) =>
      Math.min(1, new Set(items.map((item) => item.pattern).filter(Boolean)).size / items.length),
  };

export function archetypeGuidance(archetype: StyleArchetype): string {
  return ARCHETYPE_GUIDANCE[archetype];
}

export function matchStyleArchetypes(
  items: readonly ArchetypeInputItem[],
): { archetype: StyleArchetype; confidence: number }[] {
  if (items.length === 0) return [];
  return STYLE_ARCHETYPES.map((archetype) => ({
    archetype,
    confidence: Math.min(1, scorers[archetype](items)),
  }))
    .filter((entry) => entry.confidence >= 0.35)
    .sort((first, second) => second.confidence - first.confidence);
}
