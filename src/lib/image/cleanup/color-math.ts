import { HEX_COLOR } from "./constants.data";
import type { Rgb } from "./types";

export function hexToRgb(value: string): Rgb {
  const safe = HEX_COLOR.test(value) ? value : "#808080";
  return [1, 3, 5].map((offset) =>
    Number.parseInt(safe.slice(offset, offset + 2), 16),
  ) as unknown as Rgb;
}

export function colorDistance(first: Rgb, second: Rgb) {
  return first.reduce((total, channel, index) => total + (channel - (second[index] ?? 0)) ** 2, 0);
}
