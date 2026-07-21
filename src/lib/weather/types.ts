export const TEMPERATURE_BANDS = [
  "extreme_cold",
  "cold",
  "cool",
  "mild",
  "warm",
  "hot",
  "extreme_hot",
] as const;

export const CLOTHING_CONSTRAINT_TAGS = [
  "needs_outer_layer",
  "needs_insulation",
  "wind_protection",
  "rain_protection",
  "rain_safe_shoes",
  "snow_safe_footwear",
  "breathable_priority",
  "avoid_heavy_layers",
  "day_night_layer",
] as const;

export type TemperatureBand = (typeof TEMPERATURE_BANDS)[number];
export type ClothingConstraintTag = (typeof CLOTHING_CONSTRAINT_TAGS)[number];

export interface ForecastSnapshot {
  temperatureC?: number | null;
  feelsLikeC?: number | null;
  minimumTemperatureC?: number | null;
  maximumTemperatureC?: number | null;
  precipitationProbability?: number | null;
  precipitationMm?: number | null;
  snowfallCm?: number | null;
  windSpeedKph?: number | null;
  humidityPercent?: number | null;
  spansDayAndNight?: boolean;
}

export interface WeatherComfortProfile {
  runsCold?: boolean | null;
  runsHot?: boolean | null;
}

export interface ClothingConstraints {
  effectiveTemperatureC: number;
  effectiveMinimumC: number;
  effectiveMaximumC: number;
  temperatureBand: TemperatureBand;
  targetWarmthLevel: number;
  minimumOutfitWarmth: number;
  maximumItemWarmth: number;
  needsOuterLayer: boolean;
  needsInsulation: boolean;
  windProtectionRequired: boolean;
  rainProtectionRequired: boolean;
  rainSafeShoesRequired: boolean;
  snowSafeFootwearRequired: boolean;
  breathablePriority: boolean;
  avoidHeavyLayers: boolean;
  dayNightLayerRecommended: boolean;
  tags: ClothingConstraintTag[];
}
