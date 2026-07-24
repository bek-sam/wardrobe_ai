import { classifyPatternScale } from "./classify";
import { normalize } from "./normalize";

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
