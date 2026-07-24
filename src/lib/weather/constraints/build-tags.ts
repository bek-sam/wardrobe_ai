import type { ClothingConstraintTag } from "../types";

export function buildConstraintTags(flags: {
  needsOuterLayer: boolean;
  needsInsulation: boolean;
  windProtectionRequired: boolean;
  rainProtectionRequired: boolean;
  rainSafeShoesRequired: boolean;
  snowSafeFootwearRequired: boolean;
  breathablePriority: boolean;
  avoidHeavyLayers: boolean;
  dayNightLayerRecommended: boolean;
}): ClothingConstraintTag[] {
  const tags: ClothingConstraintTag[] = [];
  if (flags.needsOuterLayer) tags.push("needs_outer_layer");
  if (flags.needsInsulation) tags.push("needs_insulation");
  if (flags.windProtectionRequired) tags.push("wind_protection");
  if (flags.rainProtectionRequired) tags.push("rain_protection");
  if (flags.rainSafeShoesRequired) tags.push("rain_safe_shoes");
  if (flags.snowSafeFootwearRequired) tags.push("snow_safe_footwear");
  if (flags.breathablePriority) tags.push("breathable_priority");
  if (flags.avoidHeavyLayers) tags.push("avoid_heavy_layers");
  if (flags.dayNightLayerRecommended) tags.push("day_night_layer");
  return tags;
}
