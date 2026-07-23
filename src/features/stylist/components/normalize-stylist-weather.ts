import { isObject, safeNullableString, safeNumber } from "@/lib/api/normalize";

import { safeStrings } from "./stylist-normalize-primitives";
import type { WeatherView } from "./stylist.types";

export function normalizeWeather(value: unknown): WeatherView | null {
  if (!isObject(value)) return null;
  const snapshot = isObject(value.snapshot) ? value.snapshot : {};
  const location = isObject(value.location) ? value.location : {};
  const constraints = isObject(value.constraints) ? value.constraints : {};
  return {
    date: safeNullableString(value.date),
    locationName: safeNullableString(location.name),
    minimumC: safeNumber(snapshot.minimumTemperatureC),
    maximumC: safeNumber(snapshot.maximumTemperatureC),
    feelsLikeC: safeNumber(snapshot.feelsLikeC),
    rainProbability: safeNumber(snapshot.precipitationProbability, 0, 100),
    constraints: safeStrings(constraints.tags, 12),
  };
}
