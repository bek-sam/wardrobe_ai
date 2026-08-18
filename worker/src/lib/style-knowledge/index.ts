import type { WardrobeItemRole } from "@/features/wardrobe";
import type { TemperatureBand } from "@/lib/weather";

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
  "charcoal",
  "ivory",
  "khaki",
]);

// Coarse hue families, ordered around the color wheel, used only to classify
// adjacency/opposition -- not for any numeric scoring.
export const HUE_FAMILIES: readonly string[] = [
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "blue",
  "purple",
  "pink",
];

export const HUE_FAMILY_ALIASES: Readonly<Record<string, string>> = {
  maroon: "red",
  burgundy: "red",
  rust: "orange",
  coral: "orange",
  mustard: "yellow",
  gold: "yellow",
  olive: "green",
  mint: "green",
  turquoise: "teal",
  cyan: "teal",
  indigo: "blue",
  cobalt: "blue",
  lavender: "purple",
  violet: "purple",
  magenta: "pink",
  rose: "pink",
};

export function areAdjacent(familyA: string, familyB: string) {
  const indexA = HUE_FAMILIES.indexOf(familyA);
  const indexB = HUE_FAMILIES.indexOf(familyB);
  if (indexA === -1 || indexB === -1) return false;
  const distance = Math.abs(indexA - indexB);
  return distance === 1 || distance === HUE_FAMILIES.length - 1;
}

export function areOpposite(familyA: string, familyB: string) {
  const indexA = HUE_FAMILIES.indexOf(familyA);
  const indexB = HUE_FAMILIES.indexOf(familyB);
  if (indexA === -1 || indexB === -1) return false;
  const half = HUE_FAMILIES.length / 2;
  return Math.abs(indexA - indexB) === half;
}

export function areEvenlySpacedTriad(families: readonly string[]) {
  if (families.length !== 3) return false;
  const indices = families
    .map((family) => HUE_FAMILIES.indexOf(family))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b);
  const [first, second, third] = indices;
  if (indices.length !== 3 || first === undefined || second === undefined || third === undefined) {
    return false;
  }
  const gaps = [second - first, third - second, HUE_FAMILIES.length - (third - first)];
  const expected = HUE_FAMILIES.length / 3;
  return gaps.every((gap) => Math.abs(gap - expected) <= 1);
}

export function normalize(name: string) {
  return name.trim().toLowerCase();
}

export function hueFamilyOf(colorName: string): string | null {
  const normalized = normalize(colorName);
  if (NEUTRALS.has(normalized)) return null;
  if (HUE_FAMILIES.includes(normalized)) return normalized;
  return HUE_FAMILY_ALIASES[normalized] ?? null;
}

export type ColorHarmonyScheme =
  "monochrome" | "analogous" | "complementary" | "triadic" | "neutral_with_accent" | "clashing";

function classifyTwoHueFamilies(
  familyA: string,
  familyB: string,
  neutralCount: number,
  uniqueNameCount: number,
): { scheme: ColorHarmonyScheme; confidence: number } | null {
  if (neutralCount <= 2 && neutralCount >= uniqueNameCount - 2) {
    if (areOpposite(familyA, familyB)) return { scheme: "complementary", confidence: 0.8 };
    if (areAdjacent(familyA, familyB)) return { scheme: "analogous", confidence: 0.8 };
  }

  if (neutralCount === 0) {
    if (areOpposite(familyA, familyB)) return { scheme: "complementary", confidence: 0.65 };
    if (areAdjacent(familyA, familyB)) return { scheme: "analogous", confidence: 0.65 };
  }

  return null;
}

export function classifyOutfitColorScheme(colorNames: readonly string[]): {
  scheme: ColorHarmonyScheme;
  confidence: number;
} {
  const uniqueNames = [...new Set(colorNames.map(normalize))];
  const hueFamilies = [
    ...new Set(uniqueNames.map(hueFamilyOf).filter((f): f is string => f !== null)),
  ];
  const neutralCount = uniqueNames.filter((name) => NEUTRALS.has(name)).length;

  if (uniqueNames.length === 0) return { scheme: "neutral_with_accent", confidence: 0.2 };
  if (hueFamilies.length === 0) return { scheme: "monochrome", confidence: 0.7 };
  if (hueFamilies.length === 1 && neutralCount >= 1) {
    return { scheme: "neutral_with_accent", confidence: 0.85 };
  }
  if (hueFamilies.length === 1) return { scheme: "monochrome", confidence: 0.75 };

  const [familyA, familyB] = hueFamilies;
  if (hueFamilies.length === 2 && familyA && familyB) {
    const result = classifyTwoHueFamilies(familyA, familyB, neutralCount, uniqueNames.length);
    if (result) return result;
  }

  if (hueFamilies.length === 3 && areEvenlySpacedTriad(hueFamilies)) {
    return { scheme: "triadic", confidence: 0.6 };
  }
  if (hueFamilies.length >= 3 && neutralCount === 0) {
    return { scheme: "clashing", confidence: 0.55 };
  }

  return { scheme: "clashing", confidence: 0.4 };
}

export function describeColorSchemeGuidance(scheme: ColorHarmonyScheme): string {
  switch (scheme) {
    case "monochrome":
      return "A single color family carried across the outfit at varying depths -- reads as deliberate and cohesive.";
    case "neutral_with_accent":
      return "Neutral base with one accent color doing the work -- safe and versatile.";
    case "analogous":
      return "Adjacent hues on the color wheel -- harmonious without being flat.";
    case "complementary":
      return "Opposite hues anchored by at least one neutral -- higher-contrast but still balanced.";
    case "triadic":
      return "Three evenly-spaced hues -- bold; works best when one color clearly leads.";
    case "clashing":
      return "Multiple competing hues with no neutral anchor -- likely reads as uncoordinated.";
  }
}

const FORMALITY_DESCRIPTIONS: Readonly<Record<number, string>> = {
  1: "very casual",
  2: "casual",
  3: "smart casual",
  4: "business/formal",
  5: "black tie/formal",
};

export function describeFormalityLevel(level: number): string {
  const rounded = Math.round(Math.min(5, Math.max(1, level)));
  return FORMALITY_DESCRIPTIONS[rounded] ?? "casual";
}

export function evaluateFormalityConsistency(levels: readonly number[]): {
  consistent: boolean;
  spread: number;
  guidance: string;
} {
  if (levels.length === 0) {
    return { consistent: true, spread: 0, guidance: "No formality data available." };
  }
  const spread = Math.max(...levels) - Math.min(...levels);
  const consistent = spread <= 1;
  return {
    consistent,
    spread,
    guidance: consistent
      ? "Formality levels are consistent across the outfit."
      : `Formality spans a ${spread}-point range -- pieces may not read as belonging together.`,
  };
}

export { classifyPatternScale, evaluatePatternMix } from "./pattern-mixing";

export type { PatternScale } from "./pattern-mixing";

export { classifySilhouetteWeight, evaluateSilhouetteBalance } from "./silhouette-balance";

export type { SilhouetteWeight } from "./silhouette-balance";

export { evaluateLengthProportion } from "./proportion";

export { occasionStyleProfile } from "./occasion-profiles";

export type { OccasionStyleProfile } from "./occasion-profiles";

export { archetypeGuidance, matchStyleArchetypes, STYLE_ARCHETYPES } from "./style-archetypes";

export type { StyleArchetype } from "./style-archetypes";

// Bumped by hand whenever any rule file in this package changes its logic.
// Fed into the curator's prompt input and into the outfit-analysis-cache
// hash, so a knowledge-pack update naturally invalidates stale cached
// verdicts instead of silently serving them forever.
export const STYLE_KNOWLEDGE_VERSION = "2026-07-22.1";

// Distinct from recommendation/layering.ts, which numerically scores
// compile-time silhouette compatibility between already-selected items. This
// module instead judges whether the *number* of layers an outfit carries
// suits a given temperature band, for the curator's compact context.

const APPROPRIATE_LAYER_COUNT: Readonly<Record<TemperatureBand, readonly number[]>> = {
  extreme_hot: [0],
  hot: [0],
  warm: [0, 1],
  mild: [1],
  cool: [1, 2],
  cold: [2],
  extreme_cold: [2, 3],
};

export function evaluateLayerCount(
  layerCount: number,
  band: TemperatureBand,
): { appropriate: boolean; guidance: string } {
  const allowed = APPROPRIATE_LAYER_COUNT[band];
  if (allowed.includes(layerCount)) {
    return { appropriate: true, guidance: `${layerCount} layer(s) suits a ${band} day.` };
  }
  if (layerCount < Math.min(...allowed)) {
    return {
      appropriate: false,
      guidance: `Likely under-dressed for a ${band} day with only ${layerCount} layer(s).`,
    };
  }
  return {
    appropriate: false,
    guidance: `Likely over-dressed for a ${band} day with ${layerCount} layer(s).`,
  };
}

export function describeLayeringStrategy(
  items: readonly { role: WardrobeItemRole; warmthLevel: number | null }[],
): string {
  const layerItems = items.filter((item) => item.role === "layer");
  if (layerItems.length === 0) {
    return "No outer layer -- relies on the base top/bottom for warmth.";
  }
  const warmthValues = layerItems
    .map((item) => item.warmthLevel)
    .filter((v): v is number => v !== null);
  const averageWarmth = warmthValues.length
    ? warmthValues.reduce((sum, value) => sum + value, 0) / warmthValues.length
    : null;
  if (averageWarmth !== null && averageWarmth >= 4) {
    return "Heavy outer layer carries most of the outfit's warmth.";
  }
  return "Light-to-moderate outer layer supplements the base pieces.";
}

export type MaterialFormalityTier = "casual" | "smart_casual" | "formal";

const CASUAL_KEYWORDS = ["denim", "fleece", "jersey", "canvas", "corduroy", "flannel"];

const FORMAL_KEYWORDS = ["silk", "satin", "wool suiting", "suiting", "cashmere", "velvet", "tweed"];

const SMART_CASUAL_KEYWORDS = ["wool", "cotton twill", "twill", "leather", "linen", "chino"];

function normalizeMaterial(value: string) {
  return value.trim().toLowerCase();
}

function classifySingleMaterial(material: string): MaterialFormalityTier {
  const normalized = normalizeMaterial(material);
  if (FORMAL_KEYWORDS.some((keyword) => normalized.includes(keyword))) return "formal";
  if (CASUAL_KEYWORDS.some((keyword) => normalized.includes(keyword))) return "casual";
  if (SMART_CASUAL_KEYWORDS.some((keyword) => normalized.includes(keyword))) return "smart_casual";
  return "smart_casual";
}

export function classifyMaterialFormality(materials: readonly string[]): MaterialFormalityTier {
  if (materials.length === 0) return "smart_casual";
  const tiers = materials.map(classifySingleMaterial);
  if (tiers.includes("formal")) return "formal";
  if (tiers.every((tier) => tier === "casual")) return "casual";
  return "smart_casual";
}

export function evaluateMaterialMix(materialsByItem: readonly (readonly string[])[]): {
  harmonious: boolean;
  guidance: string;
} {
  const allMaterials = materialsByItem.flatMap((materials) => materials.map(normalizeMaterial));
  const casualSyntheticCount = allMaterials.filter((material) =>
    CASUAL_KEYWORDS.some((keyword) => material.includes(keyword)),
  ).length;
  const hasFormal = allMaterials.some((material) =>
    FORMAL_KEYWORDS.some((keyword) => material.includes(keyword)),
  );
  const hasCasual = allMaterials.some((material) =>
    CASUAL_KEYWORDS.some((keyword) => material.includes(keyword)),
  );

  if (casualSyntheticCount >= 3) {
    return {
      harmonious: false,
      guidance: "Three or more casual/synthetic textures reads as low-effort.",
    };
  }
  if (hasFormal && hasCasual) {
    return {
      harmonious: true,
      guidance: "High-low material contrast (e.g. silk with denim) can read as intentional.",
    };
  }
  return { harmonious: true, guidance: "Materials are formality-consistent." };
}

const BAND_GUIDANCE: Readonly<Record<TemperatureBand, string>> = {
  extreme_cold: "Prioritize insulation and full coverage; minimize exposed skin.",
  cold: "A substantial outer layer and warm base pieces are expected.",
  cool: "A light-to-medium layer is usually welcome.",
  mild: "Most single-layer outfits are comfortable.",
  warm: "Breathable fabrics and minimal layering.",
  hot: "Lightweight, breathable, and minimal coverage.",
  extreme_hot: "Loose, breathable fabrics; avoid dark heat-absorbing colors if outdoors.",
};

export function weatherDressingGuidance(band: TemperatureBand, rain: boolean): string {
  const base = BAND_GUIDANCE[band];
  return rain
    ? `${base} Rain expected -- prioritize water-resistant outerwear and footwear.`
    : base;
}

export function evaluateWeatherAppropriateness(
  warmthLevel: number,
  band: TemperatureBand,
): { appropriate: boolean; guidance: string } {
  const targets: Record<TemperatureBand, number> = {
    extreme_cold: 5,
    cold: 4,
    cool: 3,
    mild: 2.5,
    warm: 2,
    hot: 1,
    extreme_hot: 1,
  };
  const target = targets[band];
  const delta = Math.abs(warmthLevel - target);
  return {
    appropriate: delta <= 1,
    guidance:
      delta <= 1
        ? `Warmth level suits a ${band} day.`
        : warmthLevel < target
          ? `Likely too light for a ${band} day.`
          : `Likely too warm for a ${band} day.`,
  };
}
