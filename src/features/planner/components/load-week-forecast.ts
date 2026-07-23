import { requestJson } from "@/lib/api/request";

import { weatherFrom } from "./normalize-weather";
import type { PlanView, WeatherView } from "./planner.types";

export async function loadWeekForecast(
  dates: string[],
  plans: PlanView[],
  signal: AbortSignal,
): Promise<Map<string, WeatherView>> {
  const entries = await Promise.all(
    dates.map(async (date) => {
      const persisted = plans.find((plan) => plan.plannedDate === date && plan.weather)?.weather;
      if (persisted) return [date, persisted] as const;
      const plannedLocation = plans.find(
        (plan) => plan.plannedDate === date && plan.locationName,
      )?.locationName;
      try {
        const query = new URLSearchParams({ date });
        if (plannedLocation) query.set("location", plannedLocation);
        const raw = await requestJson<unknown>(`/api/weather?${query.toString()}`, { signal });
        return [date, weatherFrom(raw)] as const;
      } catch {
        return [date, null] as const;
      }
    }),
  );
  return new Map(
    entries.filter((entry): entry is readonly [string, WeatherView] => entry[1] !== null),
  );
}
