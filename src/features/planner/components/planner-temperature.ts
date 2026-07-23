import type { WeatherView } from "./planner.types";

export function temperature(valueC: number, unit: "celsius" | "fahrenheit") {
  return unit === "fahrenheit" ? Math.round((valueC * 9) / 5 + 32) : Math.round(valueC);
}

export function temperatureLabel(weather: WeatherView | null, unit: "celsius" | "fahrenheit") {
  if (!weather) return "—";
  const suffix = unit === "fahrenheit" ? "°F" : "°C";
  if (weather.minimumC !== null && weather.maximumC !== null) {
    return `${temperature(weather.minimumC, unit)}–${temperature(weather.maximumC, unit)}${suffix}`;
  }
  const one = weather.maximumC ?? weather.minimumC;
  return one === null ? "—" : `${temperature(one, unit)}${suffix}`;
}
