import { areAdjacent, areOpposite } from "./hue-family-geometry";
import type { ColorHarmonyScheme } from "./color-harmony.types";

export function classifyTwoHueFamilies(
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
