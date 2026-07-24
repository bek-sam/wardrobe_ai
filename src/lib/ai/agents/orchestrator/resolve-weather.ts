import { getWeatherForStyling } from "@/lib/ai/tools/get-weather";
import type { getPreferences } from "@/lib/ai/tools/get-preferences";

export async function resolveOrchestratorWeather(
  date: string,
  location: string | null | undefined,
  profile: Awaited<ReturnType<typeof getPreferences>>["profile"],
  style: Awaited<ReturnType<typeof getPreferences>>["style"],
): Promise<{
  weather: Awaited<ReturnType<typeof getWeatherForStyling>>;
  weatherWarning: string | null;
}> {
  try {
    const weather = await getWeatherForStyling({
      date,
      requestedLocation: location,
      profile,
      comfort: { runsCold: style.runs_cold, runsHot: style.runs_hot },
    });
    return { weather, weatherWarning: null };
  } catch {
    return {
      weather: null,
      weatherWarning:
        "Weather is temporarily unavailable; this look is based on occasion and preferences.",
    };
  }
}
