import type { OutfitItemRole } from "@/features/outfits/types";

export const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const outfitRoles = new Set<OutfitItemRole>([
  "top",
  "bottom",
  "dress",
  "layer",
  "shoes",
  "accessory",
]);

export const quickOccasions = ["Work", "Casual day", "Dinner", "Outdoors"];

export const constraintCopy: Readonly<Record<string, string>> = {
  needs_outer_layer: "Bring an outer layer for the cooler part of the day.",
  needs_insulation: "Insulating pieces are useful in today’s temperatures.",
  wind_protection: "A wind-blocking layer is recommended.",
  rain_protection: "Plan for rain protection.",
  rain_safe_shoes: "Choose shoes that can handle wet conditions.",
  snow_safe_footwear: "Snow-safe footwear is recommended.",
  breathable_priority: "Prioritize breathable pieces.",
  avoid_heavy_layers: "Avoid heavy layers in the warmer part of the day.",
  day_night_layer: "Keep a layer ready for the day-to-night temperature change.",
};

export const previewStatuses = new Set(["none", "queued", "generating", "ready", "failed"]);
