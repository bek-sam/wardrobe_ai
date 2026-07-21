import sharp from "sharp";

export async function createThumbnail(
  bytes: Buffer,
  options: { width?: number; height?: number; quality?: number } = {},
): Promise<Buffer> {
  const width = options.width ?? 640;
  const height = options.height ?? 640;
  const quality = options.quality ?? 82;
  return sharp(bytes)
    .rotate()
    .resize(width, height, { fit: "inside", withoutEnlargement: true })
    .webp({ quality })
    .toBuffer();
}
