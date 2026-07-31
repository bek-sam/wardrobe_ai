import type { OutfitItemRole } from "@/features/outfits/types";
import type { NormalizedRect } from "./types";

/**
 * Deterministic approximate body zones for a portrait, full-body, head-through
 * -shoes framing. Used only when localization is missing or below threshold.
 * These are labelled `source: "fallback"` and are never presented as precise
 * segmentation — the garment chips remain the accurate way to select an item.
 */
export const FALLBACK_BODY_ZONES: Record<OutfitItemRole, NormalizedRect> = {
  top: { x: 0.28, y: 0.2, width: 0.44, height: 0.24 },
  bottom: { x: 0.3, y: 0.44, width: 0.4, height: 0.35 },
  dress: { x: 0.27, y: 0.2, width: 0.46, height: 0.5 },
  layer: { x: 0.22, y: 0.18, width: 0.56, height: 0.35 },
  shoes: { x: 0.31, y: 0.85, width: 0.38, height: 0.12 },
  accessory: { x: 0.38, y: 0.12, width: 0.24, height: 0.12 },
};

/**
 * Minimum and maximum plausible normalized area per role. A "top" covering
 * 90% of the frame or 0.1% of it is a localization failure, not a garment.
 */
export const HOTSPOT_AREA_BOUNDS: Record<OutfitItemRole, { min: number; max: number }> = {
  top: { min: 0.01, max: 0.45 },
  bottom: { min: 0.01, max: 0.5 },
  dress: { min: 0.02, max: 0.65 },
  layer: { min: 0.01, max: 0.65 },
  shoes: { min: 0.001, max: 0.2 },
  accessory: { min: 0.0005, max: 0.25 },
};
