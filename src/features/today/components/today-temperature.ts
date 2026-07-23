import type { TodayProfile } from "./today.types";

export function temperature(value: number | null, unit: TodayProfile["temperatureUnit"]) {
  if (value === null) return null;
  const converted = unit === "fahrenheit" ? (value * 9) / 5 + 32 : value;
  return `${Math.round(converted)}°${unit === "fahrenheit" ? "F" : "C"}`;
}
