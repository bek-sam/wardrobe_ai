import sharp from "sharp";

import { sha256Hex } from "@/lib/visualization/freshness";

import { VisualizationProviderError } from "./provider-error";
import type { GeneratedVisualizationImage } from "./types";

/** Portrait try-on: reject anything that came back wider than it is tall. */
const MAX_ASPECT_RATIO = 0.95;

/**
 * Decodes what the provider actually returned rather than trusting the
 * declared format: a landscape or corrupt result must fail the pipeline, not
 * reach storage and get served as a ready try-on.
 */
export async function validateGeneratedImage(
  bytes: Buffer,
  requestId: string | null,
): Promise<GeneratedVisualizationImage> {
  if (bytes.byteLength === 0) {
    throw new VisualizationProviderError("invalid_output", "The provider returned no image data.");
  }

  const metadata = await sharp(bytes)
    .metadata()
    .catch(() => null);
  if (!metadata?.width || !metadata.height || metadata.format !== "png") {
    throw new VisualizationProviderError(
      "invalid_output",
      "The provider returned an image that could not be decoded.",
      requestId,
    );
  }
  if (metadata.width / metadata.height > MAX_ASPECT_RATIO) {
    throw new VisualizationProviderError(
      "invalid_output",
      "The provider returned a non-portrait image.",
      requestId,
    );
  }

  return {
    bytes,
    mimeType: "image/png",
    width: metadata.width,
    height: metadata.height,
    sha256: sha256Hex(bytes),
    requestId,
  };
}
