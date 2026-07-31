import { validateAndNormalizeImage, type ValidatedImage } from "@/lib/image/validation";
import { sha256Hex } from "@/lib/visualization/freshness";

import { IDENTITY_IMAGE_LIMITS, IDENTITY_MAX_ASPECT_RATIO } from "./limits.data";

export class IdentityUploadError extends Error {
  constructor(
    readonly code: "unreadable" | "too_wide",
    message: string,
  ) {
    super(message);
    this.name = "IdentityUploadError";
  }
}

/**
 * Validates the *decoded* bytes rather than the claimed extension or MIME
 * type, then re-encodes to a canonical sRGB PNG. `validateAndNormalizeImage`
 * runs `.rotate()` (applying and then discarding the EXIF orientation) and
 * re-encodes through sharp, which is what strips EXIF, GPS, and every other
 * metadata block — a location tag must never survive into storage.
 */
export async function normalizeIdentityUpload(
  bytes: Buffer,
): Promise<ValidatedImage & { sha256: string }> {
  let normalized: ValidatedImage;
  try {
    normalized = await validateAndNormalizeImage(bytes, IDENTITY_IMAGE_LIMITS);
  } catch (error) {
    throw new IdentityUploadError(
      "unreadable",
      error instanceof Error ? error.message : "That file could not be read as an image.",
    );
  }

  if (normalized.width / normalized.height > IDENTITY_MAX_ASPECT_RATIO) {
    throw new IdentityUploadError(
      "too_wide",
      "Use a portrait or square photo that shows you head to toe.",
    );
  }

  return { ...normalized, sha256: sha256Hex(normalized.bytes) };
}
