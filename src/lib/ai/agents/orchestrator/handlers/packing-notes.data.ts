import type { ClothingConstraintTag } from "@/lib/weather/types";
import type { OutfitItemRole } from "@/features/outfits/types";

/** Deterministic weather-tag notes; never a model's idea of "essentials". */
export const PACKING_ESSENTIAL_NOTES: Readonly<Record<ClothingConstraintTag, string>> = {
  needs_outer_layer: "at least one outer layer",
  needs_insulation: "an insulating layer for the cold days",
  wind_protection: "a wind-resistant layer",
  rain_protection: "rain protection",
  rain_safe_shoes: "shoes that handle rain",
  snow_safe_footwear: "snow-safe footwear",
  breathable_priority: "breathable fabrics for the heat",
  avoid_heavy_layers: "nothing heavier than you need",
  day_night_layer: "a layer for the temperature swing between day and night",
};

export const PACKING_ROLE_ORDER: readonly OutfitItemRole[] = [
  "dress",
  "top",
  "bottom",
  "layer",
  "shoes",
  "accessory",
];
