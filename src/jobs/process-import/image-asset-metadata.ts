import sharp from "sharp";

export async function imageAssetMetadata(bytes: Buffer, generationModel?: string | null) {
  const metadata = await sharp(bytes).metadata();
  if (!metadata.width || !metadata.height) throw new Error("Generated image metadata is invalid.");
  return {
    mime_type: "image/png",
    width: metadata.width,
    height: metadata.height,
    file_size: bytes.byteLength,
    ...(generationModel ? { generation_model: generationModel } : {}),
  };
}
