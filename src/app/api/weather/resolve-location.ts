import { ApiError } from "@/lib/api/response";
import { geocodeLocation, type ResolvedLocation } from "@/lib/weather/open-meteo";

type ProfileRow = {
  home_location_name: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  timezone: string;
} | null;

export async function resolveWeatherLocation(
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
