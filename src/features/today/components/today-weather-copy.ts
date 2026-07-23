import { readableToken } from "./today-text";
import { constraintCopy } from "./today-constants.data";
import type { WeatherView } from "./today.types";

export function weatherHeadline(weather: WeatherView) {
  if ((weather.snowfallCm ?? 0) > 0) return "Snow is in today’s forecast";
  if ((weather.rainProbability ?? 0) >= 40 || (weather.precipitationMm ?? 0) >= 0.5) {
    return "Rain is possible today";
  }
  return weather.temperatureBand
    ? `${readableToken(weather.temperatureBand)} conditions today`
    : "Today’s forecast";
}

export function weatherReasons(weather: WeatherView | null) {
  if (!weather) return [];
  return weather.constraints
    .map((constraint) => constraintCopy[constraint])
    .filter((reason): reason is string => Boolean(reason));
}
