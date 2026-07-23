// Whole-outfit palette classification. Distinct from
// recommendation/color-compatibility.ts, which scores pairwise harmony
// between items for the deterministic 7-key recommendation score. This
// module instead names the *scheme* an entire outfit's color set reads as,
// for the curator's compact per-candidate context.

export type ColorHarmonyScheme =
  "monochrome" | "analogous" | "complementary" | "triadic" | "neutral_with_accent" | "clashing";

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
  "charcoal",
  "ivory",
  "khaki",
]);

// Coarse hue families, ordered around the color wheel, used only to classify
// adjacency/opposition -- not for any numeric scoring.
const HUE_FAMILIES: readonly string[] = [
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "blue",
  "purple",
  "pink",
];

const HUE_FAMILY_ALIASES: Readonly<Record<string, string>> = {
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

function normalize(name: string) {
  return name.trim().toLowerCase();
}

function hueFamilyOf(colorName: string): string | null {
  const normalized = normalize(colorName);
  if (NEUTRALS.has(normalized)) return null;
  if (HUE_FAMILIES.includes(normalized)) return normalized;
  return HUE_FAMILY_ALIASES[normalized] ?? null;
}

function areAdjacent(familyA: string, familyB: string) {
  const indexA = HUE_FAMILIES.indexOf(familyA);
  const indexB = HUE_FAMILIES.indexOf(familyB);
  if (indexA === -1 || indexB === -1) return false;
  const distance = Math.abs(indexA - indexB);
  return distance === 1 || distance === HUE_FAMILIES.length - 1;
}

function areOpposite(familyA: string, familyB: string) {
  const indexA = HUE_FAMILIES.indexOf(familyA);
  const indexB = HUE_FAMILIES.indexOf(familyB);
  if (indexA === -1 || indexB === -1) return false;
  const half = HUE_FAMILIES.length / 2;
  return Math.abs(indexA - indexB) === half;
}

function areEvenlySpacedTriad(families: readonly string[]) {
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

export function classifyOutfitColorScheme(colorNames: readonly string[]): {
  scheme: ColorHarmonyScheme;
  confidence: number;
} {
  const uniqueNames = [...new Set(colorNames.map(normalize))];
  const hueFamilies = [
    ...new Set(uniqueNames.map(hueFamilyOf).filter((f): f is string => f !== null)),
  ];
  const neutralCount = uniqueNames.filter((name) => NEUTRALS.has(name)).length;

  if (uniqueNames.length === 0) {
    return { scheme: "neutral_with_accent", confidence: 0.2 };
  }

  if (hueFamilies.length === 0) {
    // All neutrals, or a single non-neutral repeated -- reads as monochrome.
    return { scheme: "monochrome", confidence: 0.7 };
  }

  if (hueFamilies.length === 1 && neutralCount >= 1) {
    return { scheme: "neutral_with_accent", confidence: 0.85 };
  }

  if (hueFamilies.length === 1) {
    return { scheme: "monochrome", confidence: 0.75 };
  }

  const [familyA, familyB] = hueFamilies;
  if (hueFamilies.length === 2 && familyA && familyB) {
    if (neutralCount <= 2 && neutralCount >= uniqueNames.length - 2) {
      if (areOpposite(familyA, familyB)) {
        return { scheme: "complementary", confidence: 0.8 };
      }
      if (areAdjacent(familyA, familyB)) {
        return { scheme: "analogous", confidence: 0.8 };
      }
    }

    if (neutralCount === 0) {
      if (areOpposite(familyA, familyB)) {
        return { scheme: "complementary", confidence: 0.65 };
      }
      if (areAdjacent(familyA, familyB)) {
        return { scheme: "analogous", confidence: 0.65 };
      }
    }
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
