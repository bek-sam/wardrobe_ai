import type { ImageLimits } from "@/lib/image/validation";

/**
 * Tighter than the wardrobe-photo limits: an identity reference is rendered
 * from, not catalogued, so an enormous file buys nothing and a tiny one cannot
 * carry a recognizable face.
 */
export const IDENTITY_IMAGE_LIMITS: ImageLimits = {
  maxBytes: 20 * 1024 * 1024,
  maxPixels: 30_000_000,
  maxEdge: 8_000,
  minEdge: 320,
};

/**
 * A full-body reference is portrait or roughly square. A very wide photo is
 * almost always a group shot or a landscape crop, and is rejected before a
 * model call is spent on it.
 */
export const IDENTITY_MAX_ASPECT_RATIO = 1.2;

/** Server-constructed prefix. The raw upload path is never persisted. */
export const IDENTITY_PATH_PREFIX = "identity";
