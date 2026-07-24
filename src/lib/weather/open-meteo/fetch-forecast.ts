import { getServerEnvironment } from "@/lib/env/server";

import { forecastSchema } from "./schemas";
import type { ResolvedLocation } from "./types";

export async function fetchForecast(location: ResolvedLocation, date: string) {
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
