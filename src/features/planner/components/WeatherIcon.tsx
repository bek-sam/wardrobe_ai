import { Cloud, CloudRain, Snowflake, Sun } from "@phosphor-icons/react";

import type { WeatherView } from "./planner.types";

export function WeatherIcon({ weather }: { weather: WeatherView | null }) {
  if (!weather) return <Cloud size={18} />;
  const code = weather.weatherCode;
  const snowCode = code !== null && [71, 73, 75, 77, 85, 86].includes(code);
  const precipitationCode = code !== null && ((code >= 51 && code <= 67) || code >= 80);
  if ((weather.snowfallCm ?? 0) > 0 || snowCode) return <Snowflake size={18} />;
  if ((weather.rainProbability ?? 0) >= 35 || precipitationCode) return <CloudRain size={18} />;
  if (code !== null && code > 0) return <Cloud size={18} />;
  return <Sun size={18} />;
}
