import { NextResponse } from "next/server";

import { ApiError, routeError } from "@/lib/api/response";
import { requireViewer } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { geocodeLocation, type ResolvedLocation } from "@/lib/weather";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getForecastContext } from "@/lib/weather";
import { z } from "zod";

type ProfileRow = {
  home_location_name: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  timezone: string;
} | null;

async function resolveWeatherLocation(
  query: { location?: string; latitude?: number; longitude?: number },
  profile: ProfileRow,
): Promise<ResolvedLocation> {
  let location: ResolvedLocation | null = null;
  if (query.location) {
    location = await geocodeLocation(query.location);
  } else if (query.latitude !== undefined && query.longitude !== undefined) {
    location = {
      name: "Selected location",
      latitude: query.latitude,
      longitude: query.longitude,
      timezone: profile?.timezone ?? "auto",
    };
  } else if (profile && profile.latitude !== null && profile.longitude !== null) {
    location = {
      name: profile?.home_location_name ?? "Home",
      latitude: Number(profile.latitude),
      longitude: Number(profile.longitude),
      timezone: profile.timezone,
    };
  } else if (profile?.home_location_name) {
    location = await geocodeLocation(profile.home_location_name);
  }

  if (!location) {
    throw new ApiError(422, "location_required", "Add a location before requesting weather.");
  }
  return location;
}

async function handleGetWeather(
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

const querySchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    location: z.string().trim().min(2).max(160).optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
  })
  .refine(
    (value) =>
      (value.latitude === undefined && value.longitude === undefined) ||
      (value.latitude !== undefined && value.longitude !== undefined),
    "Latitude and longitude must be supplied together.",
  );

export async function GET(request: Request) {
  try {
    const viewer = await requireViewer();
    const url = new URL(request.url);
    const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) {
      throw new ApiError(422, "invalid_weather_query", "The weather date or location is invalid.");
    }
    const supabase = await createClient();

    const data = await handleGetWeather(supabase, viewer.id, parsed.data);
    return NextResponse.json({ data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return routeError(error);
  }
}
