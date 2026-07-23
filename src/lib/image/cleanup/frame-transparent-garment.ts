import sharp from "sharp";

import { findVisibleBounds } from "./find-visible-bounds";

export async function frameTransparentGarment(
  bytes: Buffer,
  canvasSize = 1024,
  occupancy = 0.88,
): Promise<Buffer> {
  const { data, info } = await sharp(bytes)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { minX, minY, maxX, maxY } = findVisibleBounds(data, info.width, info.height);

  const trimmed = await sharp(data, { raw: info })
    .extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 })
    .png()
    .toBuffer();
  const target = Math.round(canvasSize * Math.max(0.5, Math.min(0.96, occupancy)));
  const resized = await sharp(trimmed)
    .resize(target, target, { fit: "inside", withoutEnlargement: false })
    .png()
    .toBuffer({ resolveWithObject: true });
  return sharp({
    create: {
      width: canvasSize,
      height: canvasSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: resized.data,
        left: Math.floor((canvasSize - resized.info.width) / 2),
        top: Math.floor((canvasSize - resized.info.height) / 2),
      },
    ])
    .png()
    .toBuffer();
}
