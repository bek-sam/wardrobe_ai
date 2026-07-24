import type { TemperatureBand } from "../types";

export function classifyTemperature(temperatureC: number): TemperatureBand {
  if (temperatureC <= -5) return "extreme_cold";
  if (temperatureC < 5) return "cold";
  if (temperatureC < 13) return "cool";
  if (temperatureC < 21) return "mild";
  if (temperatureC < 28) return "warm";
  if (temperatureC < 35) return "hot";
  return "extreme_hot";
}
