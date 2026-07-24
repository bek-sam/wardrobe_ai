import type { ImageLimits } from "./types";

export const DEFAULT_IMAGE_LIMITS: ImageLimits = {
  maxBytes: 20 * 1024 * 1024,
  maxPixels: 40_000_000,
  maxEdge: 12_000,
  minEdge: 64,
};
