import sharp from "sharp";

export type ImageLimits = {
  maxBytes: number;
  maxPixels: number;
  maxEdge: number;
  minEdge: number;
};

export const DEFAULT_IMAGE_LIMITS: ImageLimits = {
  maxBytes: 20 * 1024 * 1024,
  maxPixels: 40_000_000,
  maxEdge: 12_000,
  minEdge: 64,
};

export type ValidatedImage = {
  bytes: Buffer;
  mimeType: "image/png";
  width: number;
  height: number;
  originalFormat: "jpeg" | "png" | "webp";
};

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

export type CutoutDiagnostics = {
  visiblePixelRatio: number;
  touchesCanvasEdge: boolean;
  width: number;
  height: number;
};

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
