import type { getWeatherForStyling } from "@/lib/ai/tools/get-weather";

export function buildAgentWeatherContext(
  weather: Awaited<ReturnType<typeof getWeatherForStyling>>,
  indoorOutdoor: "indoor" | "outdoor" | "mixed" | null | undefined,
) {
  return weather ? { ...weather.snapshot, constraints: weather.constraints, indoorOutdoor } : null;
}
