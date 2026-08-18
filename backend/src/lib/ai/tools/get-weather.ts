import type { WeatherComfortProfile } from "@/lib/weather";
import { geocodeLocation, getForecastContext, type ResolvedLocation } from "@/lib/weather";

export async function getWeatherForStyling(input: {
  date: string;
  requestedLocation?: string | null;
  profile: {
    home_location_name?: string | null;
    latitude?: number | string | null;
    longitude?: number | string | null;
    timezone?: string | null;
  } | null;
  comfort: WeatherComfortProfile;
}) {
  let location: ResolvedLocation | null = null;
  if (input.requestedLocation) location = await geocodeLocation(input.requestedLocation);
  else if (input.profile?.latitude != null && input.profile.longitude != null) {
    location = {
      name: input.profile.home_location_name ?? "Home",
      latitude: Number(input.profile.latitude),
      longitude: Number(input.profile.longitude),
      timezone: input.profile.timezone ?? "auto",
    };
  } else if (input.profile?.home_location_name) {
    location = await geocodeLocation(input.profile.home_location_name);
  }
  if (!location) return null;
  return getForecastContext({ location, date: input.date, comfort: input.comfort });
}
