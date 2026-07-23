import { isObject, safeNumber } from "@/lib/api/normalize";

import { safeNullableString, safeStrings } from "./today-normalize-primitives";
import type { WeatherView } from "./today.types";

export function normalizeWeather(value: unknown): WeatherView | null {
  if (!isObject(value)) return null;
  const snapshot = isObject(value.snapshot) ? value.snapshot : {};
  const location = isObject(value.location) ? value.location : {};
  const constraints = isObject(value.constraints) ? value.constraints : {};
  return {
    provider: safeNullableString(value.provider),
    date: safeNullableString(value.date),
    locationName: safeNullableString(location.name),
    temperatureC: safeNumber(snapshot.temperatureC),
    feelsLikeC: safeNumber(snapshot.feelsLikeC),
    minimumC: safeNumber(snapshot.minimumTemperatureC),
    maximumC: safeNumber(snapshot.maximumTemperatureC),
    rainProbability: safeNumber(snapshot.precipitationProbability, 0, 100),
    precipitationMm: safeNumber(snapshot.precipitationMm, 0),
    snowfallCm: safeNumber(snapshot.snowfallCm, 0),
    windKph: safeNumber(snapshot.windSpeedKph, 0),
    humidityPercent: safeNumber(snapshot.humidityPercent, 0, 100),
    temperatureBand: safeNullableString(constraints.temperatureBand),
    constraints: safeStrings(constraints.tags, 12),
  };
}
