import type { z } from "zod";

import type { ForecastSnapshot } from "@/lib/weather/types";

import { dailyValue } from "./daily-value";
import type { forecastSchema } from "./schemas";

export function buildForecastSnapshot(
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
