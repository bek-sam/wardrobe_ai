import sharp from "sharp";

import type { CutoutDiagnostics } from "./types";

export async function inspectTransparentCutout(bytes: Buffer): Promise<CutoutDiagnostics> {
  const { data, info } = await sharp(bytes)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let visiblePixels = 0;
  let touchesCanvasEdge = false;

  for (let pixel = 0, index = 0; pixel < info.width * info.height; pixel += 1, index += 4) {
    if ((data[index + 3] ?? 0) <= 8) continue;
    visiblePixels += 1;
    const x = pixel % info.width;
    const y = Math.floor(pixel / info.width);
    if (x === 0 || y === 0 || x === info.width - 1 || y === info.height - 1) {
      touchesCanvasEdge = true;
    }
  }

  return {
    visiblePixelRatio: visiblePixels / (info.width * info.height),
    touchesCanvasEdge,
    width: info.width,
    height: info.height,
  };
}
