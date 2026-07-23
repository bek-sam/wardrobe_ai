export type PatternScale = "none" | "subtle" | "medium" | "bold";

const BOLD_KEYWORDS = [
  "animal print",
  "leopard",
  "zebra",
  "camo",
  "camouflage",
  "graphic",
  "tie-dye",
  "tie dye",
];
const MEDIUM_KEYWORDS = [
  "plaid",
  "check",
  "checked",
  "floral",
  "stripe",
  "striped",
  "houndstooth",
  "argyle",
  "paisley",
];
const SUBTLE_KEYWORDS = ["pinstripe", "herringbone", "micro", "textured", "heather", "melange"];

function normalize(pattern: string) {
  return pattern.trim().toLowerCase();
}

export function classifyPatternScale(pattern: string | null): PatternScale {
  if (!pattern) return "none";
  const normalized = normalize(pattern);
  if (normalized === "solid" || normalized === "none" || normalized === "") return "none";
  if (BOLD_KEYWORDS.some((keyword) => normalized.includes(keyword))) return "bold";
  if (SUBTLE_KEYWORDS.some((keyword) => normalized.includes(keyword))) return "subtle";
  if (MEDIUM_KEYWORDS.some((keyword) => normalized.includes(keyword))) return "medium";
  // An unrecognized-but-non-solid pattern is treated as medium rather than
  // assumed safe, since the curator should still weigh it against the rest
  // of the outfit.
  return "medium";
}

function shareColorFamily(patternA: string | null, patternB: string | null) {
  if (!patternA || !patternB) return false;
  const a = normalize(patternA);
  const b = normalize(patternB);
  const wordsA = new Set(a.split(/[\s-]+/));
  const wordsB = b.split(/[\s-]+/);
  return wordsB.some((word) => wordsA.has(word));
}

export function evaluatePatternMix(patterns: readonly (string | null)[]): {
  compatible: boolean;
  reason: string;
} {
  const scales = patterns.map(classifyPatternScale);
  const nonSolidIndexes = scales
    .map((scale, index) => ({ scale, index }))
    .filter((entry) => entry.scale !== "none");

  if (nonSolidIndexes.length <= 1) {
    return { compatible: true, reason: "At most one patterned piece -- always compatible." };
  }

  const boldCount = nonSolidIndexes.filter((entry) => entry.scale === "bold").length;
  if (boldCount > 1) {
    return {
      compatible: false,
      reason: "More than one bold/statement pattern competes for attention.",
    };
  }

  if (nonSolidIndexes.length === 2) {
    const [first, second] = nonSolidIndexes;
    if (!first || !second) {
      return { compatible: true, reason: "Two patterns differ in scale or share a color family." };
    }
    if (first.scale === second.scale) {
      const sharesColor = shareColorFamily(
        patterns[first.index] ?? null,
        patterns[second.index] ?? null,
      );
      if (!sharesColor) {
        return {
          compatible: false,
          reason:
            "Two patterns of the same visual scale with no shared color family tend to compete.",
        };
      }
    }
    return { compatible: true, reason: "Two patterns differ in scale or share a color family." };
  }

  return { compatible: false, reason: "Three or more patterned pieces are difficult to balance." };
}
