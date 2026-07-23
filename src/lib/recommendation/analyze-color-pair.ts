import { isNeutral, toHsl } from "./to-hsl";
import type { ColorCompatibility } from "./color-compatibility.types";

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function analyzeColorPair(
  firstColor: string | null | undefined,
  secondColor: string | null | undefined,
): ColorCompatibility {
  const first = toHsl(firstColor);
  const second = toHsl(secondColor);
  if (!first || !second) return { score: 0.5, relation: "unknown", hueDifference: null };

  if (isNeutral(first) || isNeutral(second)) {
    return { score: 0.92, relation: "neutral", hueDifference: null };
  }

  const rawDifference = Math.abs(first.hue - second.hue);
  const hueDifference = Math.min(rawDifference, 360 - rawDifference);
  const lightnessDifference = Math.abs(first.lightness - second.lightness);

  if (hueDifference <= 18) {
    return {
      score: clamp01(0.94 + Math.min(lightnessDifference, 0.3) * 0.1),
      relation: "tonal",
      hueDifference,
    };
  }
  if (hueDifference <= 60) return { score: 0.9, relation: "analogous", hueDifference };
  if (hueDifference >= 135) return { score: 0.86, relation: "complementary", hueDifference };
  if (hueDifference >= 100) return { score: 0.74, relation: "triadic", hueDifference };
  return { score: 0.64, relation: "controlled_contrast", hueDifference };
}
