import type {
  ClothingConstraintTag,
  ClothingConstraints,
  ForecastSnapshot,
  TemperatureBand,
  WeatherComfortProfile,
} from "./types";

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

const finiteOrUndefined = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

function midpoint(minimum: number | undefined, maximum: number | undefined) {
  if (minimum !== undefined && maximum !== undefined) return (minimum + maximum) / 2;
  return minimum ?? maximum;
}

function comfortAdjustment(profile: WeatherComfortProfile) {
  if (profile.runsCold && !profile.runsHot) return -3;
  if (profile.runsHot && !profile.runsCold) return 3;
  return 0;
}

export function classifyTemperature(temperatureC: number): TemperatureBand {
  if (temperatureC <= -5) return "extreme_cold";
  if (temperatureC < 5) return "cold";
  if (temperatureC < 13) return "cool";
  if (temperatureC < 21) return "mild";
  if (temperatureC < 28) return "warm";
  if (temperatureC < 35) return "hot";
  return "extreme_hot";
}

export function warmthTargets(band: TemperatureBand) {
  switch (band) {
    case "extreme_cold":
      return { targetWarmthLevel: 5, minimumOutfitWarmth: 4, maximumItemWarmth: 5 };
    case "cold":
      return { targetWarmthLevel: 4, minimumOutfitWarmth: 3, maximumItemWarmth: 5 };
    case "cool":
      return { targetWarmthLevel: 3, minimumOutfitWarmth: 2, maximumItemWarmth: 5 };
    case "mild":
      return { targetWarmthLevel: 2, minimumOutfitWarmth: 1, maximumItemWarmth: 4 };
    case "warm":
      return { targetWarmthLevel: 2, minimumOutfitWarmth: 1, maximumItemWarmth: 3 };
    case "hot":
      return { targetWarmthLevel: 1, minimumOutfitWarmth: 1, maximumItemWarmth: 2 };
    case "extreme_hot":
      return { targetWarmthLevel: 1, minimumOutfitWarmth: 1, maximumItemWarmth: 1 };
  }
}

export function deriveClothingConstraints(
  forecast: ForecastSnapshot,
  profile: WeatherComfortProfile = {},
): ClothingConstraints {
  const temperature = finiteOrUndefined(forecast.temperatureC);
  const feelsLike = finiteOrUndefined(forecast.feelsLikeC);
  const suppliedMinimum = finiteOrUndefined(forecast.minimumTemperatureC);
  const suppliedMaximum = finiteOrUndefined(forecast.maximumTemperatureC);
  const minimum =
    suppliedMinimum !== undefined && suppliedMaximum !== undefined
      ? Math.min(suppliedMinimum, suppliedMaximum)
      : suppliedMinimum;
  const maximum =
    suppliedMinimum !== undefined && suppliedMaximum !== undefined
      ? Math.max(suppliedMinimum, suppliedMaximum)
      : suppliedMaximum;
  const centralTemperature = feelsLike ?? temperature ?? midpoint(minimum, maximum);

  if (centralTemperature === undefined) {
    throw new Error("A temperature, feels-like temperature, or forecast range is required.");
  }

  const adjustment = comfortAdjustment(profile);
  const effectiveTemperatureC = centralTemperature + adjustment;
  const effectiveMinimumC =
    (minimum ?? effectiveTemperatureC) + (minimum === undefined ? 0 : adjustment);
  const effectiveMaximumC =
    (maximum ?? effectiveTemperatureC) + (maximum === undefined ? 0 : adjustment);
  const temperatureBand = classifyTemperature(effectiveTemperatureC);
  const targets = warmthTargets(temperatureBand);

  const precipitationProbability = clamp(
    finiteOrUndefined(forecast.precipitationProbability) ?? 0,
    0,
    100,
  );
  const precipitationMm = Math.max(finiteOrUndefined(forecast.precipitationMm) ?? 0, 0);
  const snowfallCm = Math.max(finiteOrUndefined(forecast.snowfallCm) ?? 0, 0);
  const windSpeedKph = Math.max(finiteOrUndefined(forecast.windSpeedKph) ?? 0, 0);
  const humidityPercent = clamp(finiteOrUndefined(forecast.humidityPercent) ?? 0, 0, 100);

  const rainProtectionRequired =
    precipitationProbability >= 40 || precipitationMm >= 0.5 || snowfallCm > 0;
  const snowSafeFootwearRequired = snowfallCm > 0;
  const rainSafeShoesRequired = rainProtectionRequired;
  const windProtectionRequired = windSpeedKph >= 25;
  const needsOuterLayer = effectiveMinimumC < 16 || windProtectionRequired;
  const needsInsulation = effectiveMinimumC < 5;
  const breathablePriority =
    effectiveMaximumC >= 24 || (effectiveMaximumC >= 20 && humidityPercent >= 70);
  const avoidHeavyLayers = effectiveMaximumC >= 25;
  const dayNightLayerRecommended = Boolean(
    forecast.spansDayAndNight && effectiveMaximumC - effectiveMinimumC >= 7,
  );

  const tags: ClothingConstraintTag[] = [];
  if (needsOuterLayer) tags.push("needs_outer_layer");
  if (needsInsulation) tags.push("needs_insulation");
  if (windProtectionRequired) tags.push("wind_protection");
  if (rainProtectionRequired) tags.push("rain_protection");
  if (rainSafeShoesRequired) tags.push("rain_safe_shoes");
  if (snowSafeFootwearRequired) tags.push("snow_safe_footwear");
  if (breathablePriority) tags.push("breathable_priority");
  if (avoidHeavyLayers) tags.push("avoid_heavy_layers");
  if (dayNightLayerRecommended) tags.push("day_night_layer");

  return {
    effectiveTemperatureC,
    effectiveMinimumC,
    effectiveMaximumC,
    temperatureBand,
    ...targets,
    needsOuterLayer,
    needsInsulation,
    windProtectionRequired,
    rainProtectionRequired,
    rainSafeShoesRequired,
    snowSafeFootwearRequired,
    breathablePriority,
    avoidHeavyLayers,
    dayNightLayerRecommended,
    tags,
  };
}
