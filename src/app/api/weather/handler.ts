import type { SupabaseClient } from "@supabase/supabase-js";

import { getForecastContext } from "@/lib/weather/open-meteo";

import { resolveWeatherLocation } from "./resolve-location";

export async function handleGetWeather(
  supabase: SupabaseClient,
  userId: string,
  query: { date: string; location?: string; latitude?: number; longitude?: number },
) {
  const [{ data: profile, error: profileError }, { data: style, error: styleError }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("home_location_name, latitude, longitude, timezone")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("style_profiles")
        .select("runs_cold, runs_hot")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
  if (profileError) throw profileError;
  if (styleError) throw styleError;

  const location = await resolveWeatherLocation(query, profile);

  return getForecastContext({
    location,
    date: query.date,
    comfort: { runsCold: style?.runs_cold, runsHot: style?.runs_hot },
  });
}
