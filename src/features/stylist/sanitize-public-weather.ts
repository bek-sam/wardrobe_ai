import { isObject, nullableNumber, nullableString } from "./history-primitives";

export function publicWeather(value: unknown) {
  if (!isObject(value)) return null;
  const snapshot = isObject(value.snapshot) ? value.snapshot : {};
  const location = isObject(value.location) ? value.location : {};
  const constraints = isObject(value.constraints) ? value.constraints : {};
  const tags = Array.isArray(constraints.tags)
    ? constraints.tags
        .filter((entry): entry is string => typeof entry === "string" && Boolean(entry.trim()))
        .slice(0, 12)
        .map((entry) => entry.slice(0, 80))
    : [];

  return {
    date:
      typeof value.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.date) ? value.date : null,
    location: { name: nullableString(location.name, 160) },
    snapshot: {
      temperatureC: nullableNumber(snapshot.temperatureC),
      feelsLikeC: nullableNumber(snapshot.feelsLikeC),
      minimumTemperatureC: nullableNumber(snapshot.minimumTemperatureC),
      maximumTemperatureC: nullableNumber(snapshot.maximumTemperatureC),
      precipitationProbability: nullableNumber(snapshot.precipitationProbability),
      precipitationMm: nullableNumber(snapshot.precipitationMm),
      snowfallCm: nullableNumber(snapshot.snowfallCm),
      windSpeedKph: nullableNumber(snapshot.windSpeedKph),
      humidityPercent: nullableNumber(snapshot.humidityPercent),
      spansDayAndNight:
        typeof snapshot.spansDayAndNight === "boolean" ? snapshot.spansDayAndNight : null,
    },
    constraints: { tags },
  };
}
