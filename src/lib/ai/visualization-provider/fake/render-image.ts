import sharp from "sharp";

import { sha256Hex } from "@/lib/visualization/freshness";

import type { GenerateVisualizationInput, GeneratedVisualizationImage } from "../types";

const WIDTH = 1024;
const HEIGHT = 1536;

/**
 * Renders a real, decodable portrait PNG with one solid band per garment, in
 * the same order the OpenAI adapter would map images to roles. Deterministic:
 * identical input produces byte-identical output, so a test can assert on the
 * content hash. Never reachable in production — the factory only returns this
 * provider when OUTFIT_VISUALIZATION_PROVIDER is explicitly set to "fake".
 */
export async function renderFakeVisualization(
  input: GenerateVisualizationInput,
): Promise<GeneratedVisualizationImage> {
  const garments = [...input.garments].sort(
    (first, second) => first.imageNumber - second.imageNumber,
  );
  const bandHeight = Math.floor(HEIGHT / Math.max(1, garments.length));
  const bands = garments.map((garment, index) => ({
    input: {
      create: {
        width: WIDTH,
        height: index === garments.length - 1 ? HEIGHT - bandHeight * index : bandHeight,
        channels: 4 as const,
        background: { r: 40 + index * 30, g: 60 + index * 20, b: 90 + index * 10, alpha: 1 },
      },
    },
    top: bandHeight * index,
    left: 0,
  }));

  const bytes = await sharp({
    create: { width: WIDTH, height: HEIGHT, channels: 4, background: "#f4f0e8" },
  })
    .composite(bands)
    .png({ compressionLevel: 9 })
    .toBuffer();

  return {
    bytes,
    mimeType: "image/png",
    width: WIDTH,
    height: HEIGHT,
    sha256: sha256Hex(bytes),
    requestId: "fake-request",
  };
}
