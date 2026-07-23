import { useCallback, useEffect, useRef, useState } from "react";

import { requestJson } from "@/lib/api/request";

import { loadPlans } from "./load-plans";
import { loadWeekForecast } from "./load-week-forecast";
import { normalizeOutfitOptions, normalizeProfile } from "./normalize-profile-outfits";
import type { OutfitOption, PlanView, ProfileView, WeatherView } from "./planner.types";

export function usePlannerWeekData(supabaseConfigured: boolean, dates: string[]) {
  const [plans, setPlans] = useState<PlanView[]>([]);
  const [outfits, setOutfits] = useState<OutfitOption[]>([]);
  const [profile, setProfile] = useState<ProfileView>({
    locationName: null,
    temperatureUnit: "celsius",
  });
  const [forecast, setForecast] = useState<Map<string, WeatherView>>(new Map());
  const [loading, setLoading] = useState(supabaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const loadWeek = useCallback(async () => {
    if (!supabaseConfigured || !dates.length) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({ from: dates[0]!, to: dates[6]!, limit: "100" });
      const [detailed, outfitResult, profileResult] = await Promise.all([
        loadPlans(query, controller.signal),
        requestJson<unknown>("/api/outfits?limit=100", { signal: controller.signal }),
        requestJson<unknown>("/api/profile", { signal: controller.signal }),
      ]);
      if (controller.signal.aborted) return;
      setPlans(detailed);
      setOutfits(normalizeOutfitOptions(outfitResult));
      setProfile(normalizeProfile(profileResult));
      const nextForecast = await loadWeekForecast(dates, detailed, controller.signal);
      if (controller.signal.aborted) return;
      setForecast(nextForecast);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError(caught instanceof Error ? caught.message : "The planner could not be loaded.");
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setLoading(false);
      }
    }
  }, [dates, supabaseConfigured]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadWeek(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadWeek, refresh]);

  useEffect(() => () => abortRef.current?.abort(), []);

  return { plans, outfits, profile, forecast, loading, error, refresh, setRefresh };
}
