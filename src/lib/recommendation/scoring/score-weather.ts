import type { WardrobeItem } from "@/features/wardrobe/types";
import type { ClothingConstraints } from "@/lib/weather";

import { resolveWardrobeItemRole } from "../item-role";
import { clamp01, normalize } from "./normalize";

export function scoreWeather(item: WardrobeItem, weather: ClothingConstraints | undefined) {
  if (!weather) return 0.65;

  const role = resolveWardrobeItemRole(item);
  const roleAdjustment = role === "layer" ? 0 : role === "top" || role === "bottom" ? -1 : -0.5;
  const target = Math.max(1, weather.targetWarmthLevel + roleAdjustment);
  let score = item.warmth_level === null ? 0.6 : 1 - Math.abs(item.warmth_level - target) / 4;
  const tags = new Set(item.weather_tags.map(normalize));

  if (weather.rainProtectionRequired && role === "shoes") {
    if (item.water_resistance === "waterproof" || item.water_resistance === "water_resistant") {
      score += 0.15;
    } else if (tags.has("rain_unsafe") || tags.has("dry_weather_only")) {
      score -= 0.5;
    }
  }
  if (weather.breathablePriority && tags.has("breathable")) score += 0.15;
  if (weather.windProtectionRequired && tags.has("windproof")) score += 0.15;
  return clamp01(score);
}
