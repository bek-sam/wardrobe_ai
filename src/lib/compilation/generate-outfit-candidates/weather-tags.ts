import type { WardrobeItem } from "@/features/wardrobe/types";
import { TEMPERATURE_BANDS, warmthTargets, type TemperatureBand } from "@/lib/weather";

import { average } from "./average";
import { RAIN_SAFE_WATER_RESISTANCE, WEATHER_BAND_TOLERANCE } from "./constants.data";

export function weatherTagsForOutfit(items: readonly WardrobeItem[]): string[] {
  const warmthLevels = items
    .map((item) => item.warmth_level)
    .filter((value): value is number => value !== null);
  const tags: string[] = [];
  if (warmthLevels.length > 0) {
    const averageWarmth = average(warmthLevels);
    for (const band of TEMPERATURE_BANDS as readonly TemperatureBand[]) {
      if (
        Math.abs(averageWarmth - warmthTargets(band).targetWarmthLevel) <= WEATHER_BAND_TOLERANCE
      ) {
        tags.push(band);
      }
    }
  }
  const hasRainSafeGear = items.some(
    (item) =>
      (item.layer_role === "shoes" || item.layer_role === "layer") &&
      item.water_resistance !== null &&
      RAIN_SAFE_WATER_RESISTANCE.has(item.water_resistance),
  );
  if (hasRainSafeGear) tags.push("rain_safe");
  return tags;
}
