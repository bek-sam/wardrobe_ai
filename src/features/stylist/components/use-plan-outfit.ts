import { requestJson } from "@/lib/api/request";

import type { useStylingContext } from "./use-styling-context";
import type { useStylistSession } from "./use-stylist-session";

export function usePlanOutfit(
  session: ReturnType<typeof useStylistSession>,
  styling: ReturnType<typeof useStylingContext>,
) {
  return async function planOutfit() {
    if (!session.savedOutfitId || !session.recommendation || session.planned) return;
    session.setSaving(true);
    session.setError(null);
    try {
      const weather = session.recommendation.weather;
      await requestJson<unknown>("/api/plans", {
        method: "POST",
        body: JSON.stringify({
          outfit_id: session.savedOutfitId,
          planned_date: styling.date,
          start_time: null,
          occasion: styling.occasion.trim() || null,
          location_name: styling.location.trim() || weather?.locationName || null,
          event_title: null,
          weather_snapshot: weather
            ? {
                minimumTemperatureC: weather.minimumC,
                maximumTemperatureC: weather.maximumC,
                precipitationProbability: weather.rainProbability,
              }
            : null,
          status: "planned",
        }),
      });
      session.setPlanned(true);
    } catch (caught) {
      session.setError(
        caught instanceof Error ? caught.message : "The outfit could not be planned.",
      );
    } finally {
      session.setSaving(false);
    }
  };
}
