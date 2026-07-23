import type { WardrobeItem, WardrobeItemRole } from "@/features/wardrobe/types";
import type { ClothingConstraints } from "@/lib/weather";

import { normalizedTags } from "./filters-tags";
import type { HardFilterReason } from "./filters.types";

export function weatherReasons(
  item: WardrobeItem,
  role: WardrobeItemRole | null,
  constraints: ClothingConstraints,
): HardFilterReason[] {
  const reasons: HardFilterReason[] = [];
  const tags = normalizedTags(item);

  if (
    item.warmth_level !== null &&
    item.warmth_level > constraints.maximumItemWarmth &&
    role !== "accessory"
  ) {
    reasons.push({ code: "weather", message: "The item is too warm for the forecast." });
  }

  if (
    constraints.rainProtectionRequired &&
    (tags.has("dry_weather_only") || (role === "shoes" && tags.has("rain_unsafe")))
  ) {
    reasons.push({ code: "weather", message: "The item is explicitly unsuitable for rain." });
  }

  if (
    constraints.snowSafeFootwearRequired &&
    role === "shoes" &&
    (tags.has("snow_unsafe") || tags.has("open_toe"))
  ) {
    reasons.push({ code: "weather", message: "The footwear is explicitly unsuitable for snow." });
  }

  if (
    constraints.effectiveMaximumC >= 24 &&
    (tags.has("cold_weather_only") || tags.has("winter_only"))
  ) {
    reasons.push({ code: "weather", message: "The item is restricted to cold weather." });
  }

  if (
    constraints.effectiveMinimumC < 5 &&
    (tags.has("hot_weather_only") || tags.has("summer_only"))
  ) {
    reasons.push({ code: "weather", message: "The item is restricted to warm weather." });
  }

  return reasons;
}
