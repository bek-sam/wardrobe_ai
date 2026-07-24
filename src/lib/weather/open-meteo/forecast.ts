import { deriveClothingConstraints } from "@/lib/weather/constraints";
import type { WeatherComfortProfile } from "@/lib/weather/types";

import { buildForecastSnapshot } from "./build-snapshot";
import { dailyValue } from "./daily-value";
import { fetchForecast } from "./fetch-forecast";
import type { ResolvedLocation } from "./types";

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
