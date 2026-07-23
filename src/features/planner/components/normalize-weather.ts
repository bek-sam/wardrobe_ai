import { isObject, safeNumber } from "@/lib/api/normalize";

import type { WeatherView } from "./planner.types";

export function weatherFrom(value: unknown): WeatherView | null {
  if (!isObject(value)) return null;
  const snapshot = isObject(value.snapshot) ? value.snapshot : value;
  const minimumC =
    safeNumber(snapshot.minimumTemperatureC) ?? safeNumber(snapshot.minimum_temperature_c);
  const maximumC =
    safeNumber(snapshot.maximumTemperatureC) ?? safeNumber(snapshot.maximum_temperature_c);
  const rainProbability =
    safeNumber(snapshot.precipitationProbability, 0, 100) ??
    safeNumber(snapshot.precipitation_probability, 0, 100);
  const snowfallCm = safeNumber(snapshot.snowfallCm, 0) ?? safeNumber(snapshot.snowfall_cm, 0);
  const weatherCode =
    safeNumber(value.weatherCode) ??
    safeNumber(value.weather_code) ??
    safeNumber(snapshot.weatherCode) ??
    safeNumber(snapshot.weather_code);
  if (
    minimumC === null &&
    maximumC === null &&
    rainProbability === null &&
    snowfallCm === null &&
    weatherCode === null
  ) {
    return null;
  }
  return { minimumC, maximumC, rainProbability, snowfallCm, weatherCode };
}
