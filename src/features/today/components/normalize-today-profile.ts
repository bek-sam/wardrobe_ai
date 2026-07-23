import { isObject, safeString } from "@/lib/api/normalize";

import { safeNullableString } from "./today-normalize-primitives";
import type { TodayProfile } from "./today.types";

export function normalizeProfile(value: unknown): TodayProfile | null {
  if (!isObject(value)) return null;
  return {
    firstName: safeNullableString(value.first_name),
    displayName: safeNullableString(value.display_name),
    locationName: safeNullableString(value.home_location_name),
    timezone: safeString(value.timezone, "UTC"),
    locale: safeString(value.locale, "en-US"),
    temperatureUnit: value.temperature_unit === "fahrenheit" ? "fahrenheit" : "celsius",
  };
}
