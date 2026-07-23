import sharp from "sharp";

import { keyedAndNeutralChannels } from "./channel-helpers";
import { hexToRgb } from "./color-math";
import { frameTransparentGarment } from "./frame-transparent-garment";
import { keyPixel } from "./key-pixel";
import { normalizeCleanupTolerance } from "./normalize-tolerance";
import { verifySpill } from "./verify-spill";

export async function processChromaBackground(
  bytes: Buffer,
  chromaKey: string,
  options: { tolerance?: number } = {},
) {
  const tolerance = normalizeCleanupTolerance(options.tolerance);
  const feather = 80;
  const target = hexToRgb(chromaKey);
  const { keyed, neutral } = keyedAndNeutralChannels(target);
  const { data, info } = await sharp(bytes)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let index = 0; index < data.length; index += 4) {
    keyPixel(data, index, target, keyed, neutral, tolerance, feather);
  }

  const keyedOutput = await sharp(data, { raw: info }).png().toBuffer();
  const framed = await frameTransparentGarment(keyedOutput);
  const diagnostics = await verifySpill(framed, target, tolerance);
  return { bytes: framed, diagnostics };
}
