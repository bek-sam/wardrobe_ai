import { NAMED_COLORS } from "./named-colors.data";
import { parseHexColor } from "./parse-hex-color";
import { rgbToHsl } from "./rgb-to-hsl";
import type { HslColor } from "./color-compatibility.types";

export function toHsl(color: string | null | undefined): HslColor | null {
  if (!color) return null;
  const namedHex = NAMED_COLORS[color.trim().toLowerCase()];
  const rgb = parseHexColor(namedHex ?? color);
  return rgb ? rgbToHsl(rgb) : null;
}

export function isNeutral(color: HslColor) {
  return color.saturation <= 0.16 || color.lightness <= 0.08 || color.lightness >= 0.94;
}
