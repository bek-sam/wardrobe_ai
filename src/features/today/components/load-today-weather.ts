import { normalizeWeather } from "./normalize-today-weather";
import { requestJson } from "./today-request";
import { TodayRequestError } from "./today-request-error";
import type { WeatherView } from "./today.types";

export async function loadTodayWeather(date: string, signal: AbortSignal): Promise<WeatherView> {
  const raw = await requestJson<unknown>(`/api/weather?date=${encodeURIComponent(date)}`, {
    signal,
  });
  const weather = normalizeWeather(raw);
  if (!weather) throw new Error("Today’s weather response could not be read.");
  return weather;
}

export function todayWeatherErrorMessage(caught: unknown): string {
  if (caught instanceof TodayRequestError && caught.code === "location_required") {
    return "Add a home location in Settings to load today’s forecast.";
  }
  return caught instanceof Error ? caught.message : "Today’s weather could not be loaded.";
}
