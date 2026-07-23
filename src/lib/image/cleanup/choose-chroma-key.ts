import { CHROMA_KEYS, HEX_COLOR } from "./constants.data";
import { colorDistance, hexToRgb } from "./color-math";
import type { Rgb } from "./types";

export function chooseChromaKey(garmentColors: readonly string[] = ["#808080"]): string {
  const fallback: Rgb = [0, 255, 0];
  const sourceColors = garmentColors.filter((color) => HEX_COLOR.test(color)).map(hexToRgb);
  if (sourceColors.length === 0) sourceColors.push(hexToRgb("#808080"));
  const selected =
    [...CHROMA_KEYS].sort((first, second) => {
      const firstMinimum = Math.min(...sourceColors.map((source) => colorDistance(first, source)));
      const secondMinimum = Math.min(
        ...sourceColors.map((source) => colorDistance(second, source)),
      );
      return secondMinimum - firstMinimum;
    })[0] ?? fallback;
  return `#${selected.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}
