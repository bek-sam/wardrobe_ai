import { z } from "zod";
import { getServerEnvironment } from "@/lib/env/server";
import { deriveClothingConstraints } from "@/lib/weather/constraints";
import type { ForecastSnapshot, WeatherComfortProfile } from "@/lib/weather/types";

const geocodingSchema = z.object({
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

const forecastSchema = z.object({
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

export type ResolvedLocation = {
  name: string;
  latitude: number;
  longitude: number;
  timezone: string;
};

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

function dailyValue<T>(values: readonly T[], index: number): T | undefined {
  return values[index];
}

export async function getForecastContext(input: {
  location: ResolvedLocation;
  date: string;
  comfort?: WeatherComfortProfile;
}) {
  const environment = getServerEnvironment();
  const url = new URL(environment.OPEN_METEO_FORECAST_URL);
  url.searchParams.set("latitude", String(input.location.latitude));
  url.searchParams.set("longitude", String(input.location.longitude));
  url.searchParams.set("timezone", input.location.timezone || "auto");
  url.searchParams.set("start_date", input.date);
  url.searchParams.set("end_date", input.date);
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
  const dayIndex = forecast.daily.time.indexOf(input.date);
  if (dayIndex < 0) throw new Error("The requested date is outside the available forecast.");
  const currentApplies = forecast.current?.time.startsWith(input.date) ?? false;
  const minimum = dailyValue(forecast.daily.apparent_temperature_min, dayIndex);
  const maximum = dailyValue(forecast.daily.apparent_temperature_max, dayIndex);
  const snapshot: ForecastSnapshot = {
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
