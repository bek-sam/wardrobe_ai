import { getServerEnvironment } from "@/lib/env/server";

import { geocodingSchema } from "./schemas";
import type { ResolvedLocation } from "./types";

export async function geocodeLocation(query: string): Promise<ResolvedLocation | null> {
  const environment = getServerEnvironment();
  const url = new URL(environment.OPEN_METEO_GEOCODING_URL);
  url.searchParams.set("name", query);
  url.searchParams.set("count", "5");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 86_400 },
  });
  if (!response.ok) throw new Error("Location lookup is unavailable.");
  const parsed = geocodingSchema.parse(await response.json());
  const result = parsed.results?.[0];
  if (!result) return null;
  return {
    name: [result.name, result.admin1, result.country].filter(Boolean).join(", "),
    latitude: result.latitude,
    longitude: result.longitude,
    timezone: result.timezone,
  };
}
