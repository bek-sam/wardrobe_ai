import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, routeError } from "@/lib/api/response";
import { requireViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import {
  geocodeLocation,
  getForecastContext,
  type ResolvedLocation,
} from "@/lib/weather/open-meteo";

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
    const [{ data: profile, error: profileError }, { data: style, error: styleError }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("home_location_name, latitude, longitude, timezone")
          .eq("id", viewer.id)
          .maybeSingle(),
        supabase
          .from("style_profiles")
          .select("runs_cold, runs_hot")
          .eq("user_id", viewer.id)
          .maybeSingle(),
      ]);
    if (profileError) throw profileError;
    if (styleError) throw styleError;

    let location: ResolvedLocation | null = null;
    if (parsed.data.location) location = await geocodeLocation(parsed.data.location);
    else if (parsed.data.latitude !== undefined && parsed.data.longitude !== undefined) {
      location = {
        name: "Selected location",
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
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

    const data = await getForecastContext({
      location,
      date: parsed.data.date,
      comfort: { runsCold: style?.runs_cold, runsHot: style?.runs_hot },
    });
    return NextResponse.json({ data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return routeError(error);
  }
}
