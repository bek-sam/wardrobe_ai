import type { TemperatureBand } from "@/lib/weather";

export const OPTIONAL_ROLE_SCORE_THRESHOLD = 0.5;
export const MAX_SHOE_VARIANTS = 2;
export const MAX_ACCESSORY_VARIANTS = 2;
export const MAX_FOUNDATIONS_PER_BUCKET_DEFAULT = 60;
// How many layer/footwear/accessory variants of the *same* foundation within
// one bucket are allowed to survive final selection (selectBalancedOutfitPlans
// otherwise treats repeated use of one foundation as low-diversity noise).
export const MAX_VARIANTS_PER_FOUNDATION_BUCKET = 6;
// Bands whose comfort range an outfit's aggregate warmth reasonably covers
// (tolerance of 1 warmth point either side of the band's own target).
export const WEATHER_BAND_TOLERANCE = 1;
export const RAIN_SAFE_WATER_RESISTANCE = new Set(["water_resistant", "waterproof"]);

// Representative midpoint temperatures purely for the synthetic constraints in
// synthetic-weather.ts; scoreWeather() never reads these fields directly (only
// targetWarmthLevel/rainProtectionRequired/breathablePriority/
// windProtectionRequired), so they only need to be internally consistent.
export const BAND_REPRESENTATIVE_TEMPERATURE_C: Record<TemperatureBand, number> = {
  extreme_cold: -10,
  cold: 0,
  cool: 9,
  mild: 17,
  warm: 24,
  hot: 30,
  extreme_hot: 37,
};

// Bounds the extra weather-biased fan-out to the foundations most likely to
// be suggested at all, keeping the added cost a small constant factor per
// bucket rather than growing with wardrobe size.
export const WEATHER_VARIANT_FOUNDATION_LIMIT = 10;
