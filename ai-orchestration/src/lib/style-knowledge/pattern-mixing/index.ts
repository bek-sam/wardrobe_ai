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
  // Treat an unrecognized non-solid pattern as medium so it still participates
  // in deterministic compatibility checks.
  return "medium";
}

function shareColorFamily(patternA: string | null, patternB: string | null) {
  if (!patternA || !patternB) return false;
  const wordsA = new Set(normalize(patternA).split(/[\s-]+/));
  return normalize(patternB)
    .split(/[\s-]+/)
    .some((word) => wordsA.has(word));
}

export function evaluatePatternMix(patterns: readonly (string | null)[]): {
  compatible: boolean;
  reason: string;
} {
  const nonSolid = patterns
    .map((pattern, index) => ({ scale: classifyPatternScale(pattern), index }))
    .filter((entry) => entry.scale !== "none");

  if (nonSolid.length <= 1) {
    return { compatible: true, reason: "At most one patterned piece -- always compatible." };
  }
  if (nonSolid.filter((entry) => entry.scale === "bold").length > 1) {
    return {
      compatible: false,
      reason: "More than one bold/statement pattern competes for attention.",
    };
  }
  if (nonSolid.length === 2) {
    const [first, second] = nonSolid;
    if (
      first &&
      second &&
      first.scale === second.scale &&
      !shareColorFamily(patterns[first.index] ?? null, patterns[second.index] ?? null)
    ) {
      return {
        compatible: false,
        reason:
          "Two patterns of the same visual scale with no shared color family tend to compete.",
      };
    }
    return { compatible: true, reason: "Two patterns differ in scale or share a color family." };
  }
  return { compatible: false, reason: "Three or more patterned pieces are difficult to balance." };
}
