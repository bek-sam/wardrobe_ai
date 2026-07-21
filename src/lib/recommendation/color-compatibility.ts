import type { WardrobeItem } from "@/features/wardrobe/types";

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

interface HslColor {
  hue: number;
  saturation: number;
  lightness: number;
}

const NAMED_COLORS: Readonly<Record<string, string>> = {
  black: "#111111",
  white: "#f7f7f5",
  gray: "#808080",
  grey: "#808080",
  charcoal: "#36454f",
  cream: "#fffdd0",
  ivory: "#fffff0",
  beige: "#d8c3a5",
  camel: "#c19a6b",
  brown: "#795548",
  navy: "#1b2a4a",
  blue: "#2563eb",
  teal: "#0f766e",
  green: "#2f855a",
  olive: "#708238",
  yellow: "#eab308",
  orange: "#ea580c",
  red: "#dc2626",
  burgundy: "#800020",
  pink: "#ec4899",
  purple: "#7e22ce",
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

function parseHex(value: string): [number, number, number] | null {
  const normalized = value.trim().toLowerCase();
  const expanded = /^#[0-9a-f]{3}$/.test(normalized)
    ? `#${normalized
        .slice(1)
        .split("")
        .map((character) => character.repeat(2))
        .join("")}`
    : normalized;
  if (!/^#[0-9a-f]{6}$/.test(expanded)) return null;

  return [
    Number.parseInt(expanded.slice(1, 3), 16),
    Number.parseInt(expanded.slice(3, 5), 16),
    Number.parseInt(expanded.slice(5, 7), 16),
  ];
}

function rgbToHsl([redByte, greenByte, blueByte]: [number, number, number]): HslColor {
  const red = redByte / 255;
  const green = greenByte / 255;
  const blue = blueByte / 255;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;
  const lightness = (maximum + minimum) / 2;

  if (delta === 0) return { hue: 0, saturation: 0, lightness };

  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue: number;
  if (maximum === red) hue = 60 * (((green - blue) / delta) % 6);
  else if (maximum === green) hue = 60 * ((blue - red) / delta + 2);
  else hue = 60 * ((red - green) / delta + 4);

  return { hue: hue < 0 ? hue + 360 : hue, saturation, lightness };
}

function toHsl(color: string | null | undefined): HslColor | null {
  if (!color) return null;
  const namedHex = NAMED_COLORS[color.trim().toLowerCase()];
  const rgb = parseHex(namedHex ?? color);
  return rgb ? rgbToHsl(rgb) : null;
}

function isNeutral(color: HslColor) {
  return color.saturation <= 0.16 || color.lightness <= 0.08 || color.lightness >= 0.94;
}

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

function primaryItemColor(item: Pick<WardrobeItem, "primary_color_hex" | "color_names">) {
  return item.primary_color_hex ?? item.color_names[0] ?? null;
}

export function scoreColorHarmony(
  items: readonly Pick<WardrobeItem, "primary_color_hex" | "color_names">[],
): number {
  if (items.length < 2) return items.length === 1 ? 0.75 : 0.5;

  const pairScores: number[] = [];
  for (let firstIndex = 0; firstIndex < items.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < items.length; secondIndex += 1) {
      const first = items[firstIndex];
      const second = items[secondIndex];
      if (!first || !second) continue;
      pairScores.push(analyzeColorPair(primaryItemColor(first), primaryItemColor(second)).score);
    }
  }

  if (pairScores.length === 0) return 0.5;
  return pairScores.reduce((total, score) => total + score, 0) / pairScores.length;
}
