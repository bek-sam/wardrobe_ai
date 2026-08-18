import sharp from "sharp";
import { normalizeBoundingBox } from "./metadata.mjs";

export function extension(mime = "image/png") {
  return { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }[mime] || "png";
}

export function decodeImage(input) {
  const raw = input.imageDataUrl || input.imageBase64;
  if (!raw || typeof raw !== "string")
    throw Object.assign(new Error("imageDataUrl or imageBase64 is required"), { status: 400 });
  const match = raw.match(/^data:([^;]+);base64,(.+)$/s);
  const mime = match?.[1] || input.mimeType || "image/png";
  const data = Buffer.from(match?.[2] || raw, "base64");
  if (!data.length) throw Object.assign(new Error("Image payload is empty"), { status: 400 });
  return { data, mime };
}

export async function normalizeImage(bytes) {
  return sharp(bytes).rotate().toColorspace("srgb").png().toBuffer();
}

export async function cropDetectedItem(bytes, boundingBox) {
  const normalized = await normalizeImage(bytes);
  const { width, height } = await sharp(normalized).metadata();
  const box = normalizeBoundingBox(boundingBox);
  const rawLeft = (box.x / 1000) * width;
  const rawTop = (box.y / 1000) * height;
  const rawWidth = (box.width / 1000) * width;
  const rawHeight = (box.height / 1000) * height;
  const padding = Math.max(12, Math.round(Math.max(rawWidth, rawHeight) * 0.08));
  const left = Math.max(0, Math.floor(rawLeft - padding));
  const top = Math.max(0, Math.floor(rawTop - padding));
  const right = Math.min(width, Math.ceil(rawLeft + rawWidth + padding));
  const bottom = Math.min(height, Math.ceil(rawTop + rawHeight + padding));
  return sharp(normalized)
    .extract({ left, top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) })
    .png()
    .toBuffer();
}
