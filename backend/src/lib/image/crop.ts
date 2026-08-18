import sharp from "sharp";
import { validateAndNormalizeImage } from "@/lib/image/validation";

export type NormalizedBoundingBox = { x: number; y: number; width: number; height: number };
export type PixelCrop = { left: number; top: number; width: number; height: number };

export function normalizeBoundingBox(value: Partial<NormalizedBoundingBox>): NormalizedBoundingBox {
  const integer = (candidate: number | undefined, fallback: number) =>
    Number.isFinite(candidate) ? Math.round(candidate as number) : fallback;
  const x = Math.max(0, Math.min(999, integer(value.x, 0)));
  const y = Math.max(0, Math.min(999, integer(value.y, 0)));
  const width = Math.max(1, Math.min(1000 - x, integer(value.width, 1000 - x)));
  const height = Math.max(1, Math.min(1000 - y, integer(value.height, 1000 - y)));
  return { x, y, width, height };
}

export function calculatePaddedCrop(
  imageWidth: number,
  imageHeight: number,
  boundingBox: Partial<NormalizedBoundingBox>,
): PixelCrop {
  const box = normalizeBoundingBox(boundingBox);
  const rawLeft = (box.x / 1000) * imageWidth;
  const rawTop = (box.y / 1000) * imageHeight;
  const rawWidth = (box.width / 1000) * imageWidth;
  const rawHeight = (box.height / 1000) * imageHeight;
  const padding = Math.max(12, Math.round(Math.max(rawWidth, rawHeight) * 0.08));
  const left = Math.max(0, Math.floor(rawLeft - padding));
  const top = Math.max(0, Math.floor(rawTop - padding));
  const right = Math.min(imageWidth, Math.ceil(rawLeft + rawWidth + padding));
  const bottom = Math.min(imageHeight, Math.ceil(rawTop + rawHeight + padding));
  return { left, top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
}

export async function cropDetectedItem(
  input: Buffer,
  boundingBox: Partial<NormalizedBoundingBox>,
): Promise<Buffer> {
  const normalized = await validateAndNormalizeImage(input);
  const crop = calculatePaddedCrop(normalized.width, normalized.height, boundingBox);
  return sharp(normalized.bytes).extract(crop).png({ compressionLevel: 9 }).toBuffer();
}
