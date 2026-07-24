import sharp from "sharp";

import { DEFAULT_IMAGE_LIMITS } from "./default-limits.data";
import type { ImageLimits, ValidatedImage } from "./types";

export async function validateAndNormalizeImage(
  input: Buffer,
  limits: ImageLimits = DEFAULT_IMAGE_LIMITS,
): Promise<ValidatedImage> {
  if (input.byteLength === 0) throw new Error("The uploaded image is empty.");
  if (input.byteLength > limits.maxBytes) throw new Error("The uploaded image is too large.");

  const pipeline = sharp(input, { animated: false, limitInputPixels: limits.maxPixels });
  const metadata = await pipeline.metadata();
  if (!metadata.width || !metadata.height)
    throw new Error("The image dimensions could not be read.");
  if (!metadata.format || !["jpeg", "png", "webp"].includes(metadata.format)) {
    throw new Error("Only decoded JPEG, PNG, and WebP images are supported.");
  }
  if ((metadata.pages ?? 1) > 1) throw new Error("Animated images are not supported.");
  if (Math.min(metadata.width, metadata.height) < limits.minEdge) {
    throw new Error("The image is too small to analyze reliably.");
  }
  if (Math.max(metadata.width, metadata.height) > limits.maxEdge) {
    throw new Error("The image dimensions exceed the allowed limit.");
  }

  const bytes = await pipeline
    .rotate()
    .toColorspace("srgb")
    .png({ compressionLevel: 9 })
    .toBuffer();
  const normalized = await sharp(bytes).metadata();
  if (!normalized.width || !normalized.height) throw new Error("Image normalization failed.");

  return {
    bytes,
    mimeType: "image/png",
    width: normalized.width,
    height: normalized.height,
    originalFormat: metadata.format as ValidatedImage["originalFormat"],
  };
}
