import { average, suppressSpill } from "./channel-helpers";
import { colorDistance } from "./color-math";
import type { Rgb } from "./types";

export function keyPixel(
  data: Buffer,
  index: number,
  target: Rgb,
  keyed: readonly number[],
  neutral: readonly number[],
  tolerance: number,
  feather: number,
) {
  const pixel: Rgb = [data[index] ?? 0, data[index + 1] ?? 0, data[index + 2] ?? 0];
  const distance = Math.sqrt(colorDistance(pixel, target));
  if (distance <= tolerance) {
    data.fill(0, index, index + 4);
    return;
  }
  if (distance < tolerance + feather) {
    data[index + 3] = Math.round((data[index + 3] ?? 255) * ((distance - tolerance) / feather));
  }
  const neutralLevel = average(data, index, neutral);
  const spill = Math.max(0, average(data, index, keyed) - neutralLevel);
  if (spill > 0) {
    const alphaScale = Math.max(0, 1 - Math.max(0, spill - 4) / 150);
    data[index + 3] = Math.round((data[index + 3] ?? 255) * alphaScale);
    suppressSpill(data, index, keyed, neutralLevel);
  }
  if ((data[index + 3] ?? 0) <= 8) data.fill(0, index, index + 4);
}
