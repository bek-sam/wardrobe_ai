import type { Rgb } from "./types";

export const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export const CHROMA_KEYS: readonly Rgb[] = [
  [0, 255, 0],
  [255, 0, 255],
  [0, 255, 255],
];
