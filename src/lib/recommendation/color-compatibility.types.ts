export type ColorRelation =
  | "unknown"
  | "neutral"
  | "tonal"
  | "analogous"
  | "complementary"
  | "triadic"
  | "controlled_contrast";

export interface ColorCompatibility {
  score: number;
  relation: ColorRelation;
  hueDifference: number | null;
}

export interface HslColor {
  hue: number;
  saturation: number;
  lightness: number;
}
