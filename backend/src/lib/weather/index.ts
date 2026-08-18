import { z } from "zod";
import { getServerEnvironment } from "@/lib/env/server";

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

const finite = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

function computeEffectiveTemperatures(forecast: ForecastSnapshot, profile: WeatherComfortProfile) {
  const temperature = finite(forecast.temperatureC);
  const feelsLike = finite(forecast.feelsLikeC);
  const suppliedMinimum = finite(forecast.minimumTemperatureC);
  const suppliedMaximum = finite(forecast.maximumTemperatureC);
  const minimum =
    suppliedMinimum !== undefined && suppliedMaximum !== undefined
      ? Math.min(suppliedMinimum, suppliedMaximum)
      : suppliedMinimum;
  const maximum =
    suppliedMinimum !== undefined && suppliedMaximum !== undefined
      ? Math.max(suppliedMinimum, suppliedMaximum)
      : suppliedMaximum;
  const midpoint =
    minimum !== undefined && maximum !== undefined ? (minimum + maximum) / 2 : (minimum ?? maximum);
  const centralTemperature = feelsLike ?? temperature ?? midpoint;
  if (centralTemperature === undefined) {
    throw new Error("A temperature, feels-like temperature, or forecast range is required.");
  }
  const adjustment =
    profile.runsCold && !profile.runsHot ? -3 : profile.runsHot && !profile.runsCold ? 3 : 0;
  const effectiveTemperatureC = centralTemperature + adjustment;
  const effectiveMinimumC =
    (minimum ?? effectiveTemperatureC) + (minimum === undefined ? 0 : adjustment);
  const effectiveMaximumC =
    (maximum ?? effectiveTemperatureC) + (maximum === undefined ? 0 : adjustment);
  const temperatureBand = classifyTemperature(effectiveTemperatureC);
  return {
    effectiveTemperatureC,
    effectiveMinimumC,
    effectiveMaximumC,
    temperatureBand,
    targets: warmthTargets(temperatureBand),
  };
}

function constraintTags(flags: {
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

function deriveConstraintFlags(
  forecast: ForecastSnapshot,
  effectiveMinimumC: number,
  effectiveMaximumC: number,
) {
  const precipitationProbability = clamp(finite(forecast.precipitationProbability) ?? 0, 0, 100);
  const precipitationMm = Math.max(finite(forecast.precipitationMm) ?? 0, 0);
  const snowfallCm = Math.max(finite(forecast.snowfallCm) ?? 0, 0);
  const windSpeedKph = Math.max(finite(forecast.windSpeedKph) ?? 0, 0);
  const humidityPercent = clamp(finite(forecast.humidityPercent) ?? 0, 0, 100);
  const rainProtectionRequired =
    precipitationProbability >= 40 || precipitationMm >= 0.5 || snowfallCm > 0;
  const windProtectionRequired = windSpeedKph >= 25;
  const flags = {
    needsOuterLayer: effectiveMinimumC < 16 || windProtectionRequired,
    needsInsulation: effectiveMinimumC < 5,
    windProtectionRequired,
    rainProtectionRequired,
    rainSafeShoesRequired: rainProtectionRequired,
    snowSafeFootwearRequired: snowfallCm > 0,
    breathablePriority:
      effectiveMaximumC >= 24 || (effectiveMaximumC >= 20 && humidityPercent >= 70),
    avoidHeavyLayers: effectiveMaximumC >= 25,
    dayNightLayerRecommended: Boolean(
      forecast.spansDayAndNight && effectiveMaximumC - effectiveMinimumC >= 7,
    ),
  };
  return { ...flags, tags: constraintTags(flags) };
}

export function deriveClothingConstraints(
  forecast: ForecastSnapshot,
  profile: WeatherComfortProfile = {},
): ClothingConstraints {
  const temperatures = computeEffectiveTemperatures(forecast, profile);
  const flags = deriveConstraintFlags(
    forecast,
    temperatures.effectiveMinimumC,
    temperatures.effectiveMaximumC,
  );
  return {
    effectiveTemperatureC: temperatures.effectiveTemperatureC,
    effectiveMinimumC: temperatures.effectiveMinimumC,
    effectiveMaximumC: temperatures.effectiveMaximumC,
    temperatureBand: temperatures.temperatureBand,
    ...temperatures.targets,
    ...flags,
  };
}

export type ResolvedLocation = {
  name: string;
  latitude: number;
  longitude: number;
  timezone: string;
};

export const geocodingSchema = z.object({
  results: z
    .array(
      z.object({
        name: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        timezone: z.string(),
        country: z.string().optional(),
        admin1: z.string().optional(),
      }),
    )
    .optional(),
});

export const forecastSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  timezone: z.string(),
  current: z
    .object({
      time: z.string(),
      temperature_2m: z.number().optional(),
      apparent_temperature: z.number().optional(),
      relative_humidity_2m: z.number().optional(),
      precipitation: z.number().optional(),
      snowfall: z.number().optional(),
      wind_speed_10m: z.number().optional(),
      weather_code: z.number().optional(),
    })
    .optional(),
  daily: z.object({
    time: z.array(z.string()),
    temperature_2m_min: z.array(z.number().nullable()),
    temperature_2m_max: z.array(z.number().nullable()),
    apparent_temperature_min: z.array(z.number().nullable()),
    apparent_temperature_max: z.array(z.number().nullable()),
    precipitation_probability_max: z.array(z.number().nullable()),
    precipitation_sum: z.array(z.number().nullable()),
    snowfall_sum: z.array(z.number().nullable()),
    wind_speed_10m_max: z.array(z.number().nullable()),
    relative_humidity_2m_mean: z.array(z.number().nullable()).optional(),
    weather_code: z.array(z.number().nullable()),
    sunrise: z.array(z.string()),
    sunset: z.array(z.string()),
  }),
});

function dailyValue<T>(values: readonly T[], index: number): T | undefined {
  return values[index];
}

function buildForecastSnapshot(
  forecast: z.infer<typeof forecastSchema>,
  dayIndex: number,
  currentApplies: boolean,
): ForecastSnapshot {
  const minimum = dailyValue(forecast.daily.apparent_temperature_min, dayIndex);
  const maximum = dailyValue(forecast.daily.apparent_temperature_max, dayIndex);
  return {
    temperatureC: currentApplies ? forecast.current?.temperature_2m : null,
    feelsLikeC: currentApplies ? forecast.current?.apparent_temperature : null,
    minimumTemperatureC: minimum ?? dailyValue(forecast.daily.temperature_2m_min, dayIndex) ?? null,
    maximumTemperatureC: maximum ?? dailyValue(forecast.daily.temperature_2m_max, dayIndex) ?? null,
    precipitationProbability:
      dailyValue(forecast.daily.precipitation_probability_max, dayIndex) ?? null,
    precipitationMm: dailyValue(forecast.daily.precipitation_sum, dayIndex) ?? null,
    snowfallCm: dailyValue(forecast.daily.snowfall_sum, dayIndex) ?? null,
    windSpeedKph:
      (currentApplies ? forecast.current?.wind_speed_10m : undefined) ??
      dailyValue(forecast.daily.wind_speed_10m_max, dayIndex) ??
      null,
    humidityPercent:
      (currentApplies ? forecast.current?.relative_humidity_2m : undefined) ??
      dailyValue(forecast.daily.relative_humidity_2m_mean ?? [], dayIndex) ??
      null,
    spansDayAndNight: true,
  };
}

async function fetchForecast(location: ResolvedLocation, date: string) {
  const environment = getServerEnvironment();
  const url = new URL(environment.OPEN_METEO_FORECAST_URL);
  url.searchParams.set("latitude", String(location.latitude));
  url.searchParams.set("longitude", String(location.longitude));
  url.searchParams.set("timezone", location.timezone || "auto");
  url.searchParams.set("start_date", date);
  url.searchParams.set("end_date", date);
  url.searchParams.set(
    "current",
    "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,snowfall,weather_code,wind_speed_10m",
  );
  url.searchParams.set(
    "daily",
    "temperature_2m_min,temperature_2m_max,apparent_temperature_min,apparent_temperature_max,precipitation_probability_max,precipitation_sum,snowfall_sum,wind_speed_10m_max,relative_humidity_2m_mean,weather_code,sunrise,sunset",
  );
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: environment.WEATHER_CACHE_TTL_SECONDS },
  });
  if (!response.ok) throw new Error("Weather forecast is unavailable.");
  const forecast = forecastSchema.parse(await response.json());
  const dayIndex = forecast.daily.time.indexOf(date);
  if (dayIndex < 0) throw new Error("The requested date is outside the available forecast.");
  const currentApplies = forecast.current?.time.startsWith(date) ?? false;
  return { forecast, dayIndex, currentApplies };
}

export async function getForecastContext(input: {
  location: ResolvedLocation;
  date: string;
  comfort?: WeatherComfortProfile;
}) {
  const { forecast, dayIndex, currentApplies } = await fetchForecast(input.location, input.date);
  const snapshot = buildForecastSnapshot(forecast, dayIndex, currentApplies);
  return {
    provider: "Open-Meteo",
    date: input.date,
    location: input.location,
    timezone: forecast.timezone,
    snapshot,
    constraints: deriveClothingConstraints(snapshot, input.comfort),
    weatherCode: dailyValue(forecast.daily.weather_code, dayIndex) ?? null,
    sunrise: dailyValue(forecast.daily.sunrise, dayIndex) ?? null,
    sunset: dailyValue(forecast.daily.sunset, dayIndex) ?? null,
  };
}

export async function geocodeLocation(query: string): Promise<ResolvedLocation | null> {
  const environment = getServerEnvironment();
  const url = new URL(environment.OPEN_METEO_GEOCODING_URL);
  url.searchParams.set("name", query);
  url.searchParams.set("count", "5");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 86_400 },
  });
  if (!response.ok) throw new Error("Location lookup is unavailable.");
  const parsed = geocodingSchema.parse(await response.json());
  const result = parsed.results?.[0];
  if (!result) return null;
  return {
    name: [result.name, result.admin1, result.country].filter(Boolean).join(", "),
    latitude: result.latitude,
    longitude: result.longitude,
    timezone: result.timezone,
  };
}
