import sharp from "sharp";

import { average, keyedAndNeutralChannels } from "./channel-helpers";
import type { CleanupDiagnostics, Rgb } from "./types";

export async function verifySpill(
  bytes: Buffer,
  target: Rgb,
  tolerance: number,
): Promise<CleanupDiagnostics> {
  const { keyed, neutral } = keyedAndNeutralChannels(target);
  const { data } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let visiblePixels = 0;
  let contaminatedPixels = 0;
  let maxSpill = 0;
  for (let index = 0; index < data.length; index += 4) {
    if ((data[index + 3] ?? 0) <= 8) continue;
    visiblePixels += 1;
    const spill = Math.max(0, average(data, index, keyed) - average(data, index, neutral));
    maxSpill = Math.max(maxSpill, spill);
    if (spill > 2) contaminatedPixels += 1;
  }
  const contaminationRatio = visiblePixels === 0 ? 1 : contaminatedPixels / visiblePixels;
  return {
    contaminatedPixels,
    visiblePixels,
    contaminationRatio,
    maxSpill,
    tolerance,
    accepted: visiblePixels > 0 && contaminationRatio <= 0.0005,
  };
}
