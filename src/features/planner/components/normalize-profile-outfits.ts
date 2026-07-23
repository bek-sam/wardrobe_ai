import { isObject, safeNullableString, safeString } from "@/lib/api/normalize";

import { uuidPattern } from "./planner-constants.data";
import type { OutfitOption, ProfileView } from "./planner.types";

export function normalizeProfile(value: unknown): ProfileView {
  if (!isObject(value)) return { locationName: null, temperatureUnit: "celsius" };
  return {
    locationName: safeNullableString(value.home_location_name),
    temperatureUnit: value.temperature_unit === "fahrenheit" ? "fahrenheit" : "celsius",
  };
}

export function normalizeOutfitOptions(value: unknown): OutfitOption[] {
  if (!isObject(value) || !Array.isArray(value.outfits)) return [];
  return value.outfits
    .filter((entry): entry is Record<string, unknown> => isObject(entry))
    .flatMap((entry) => {
      const id = safeString(entry.id);
      return uuidPattern.test(id) ? [{ id, name: safeString(entry.name, "Saved outfit") }] : [];
    });
}
