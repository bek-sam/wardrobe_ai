import { classifyTwoHueFamilies } from "./classify-two-hue-families";
import { areEvenlySpacedTriad } from "./hue-family-geometry";
import { hueFamilyOf, normalize } from "./hue-family-lookup";
import { NEUTRALS } from "./hue-families.data";
import type { ColorHarmonyScheme } from "./color-harmony.types";

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
