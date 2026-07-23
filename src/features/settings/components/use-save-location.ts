import type { FormEvent } from "react";

import type { LocationFormState, Profile } from "./settings.types";

export function useSaveLocation(
  locationForm: LocationFormState,
  save: (key: string, path: string, body: Record<string, unknown>) => Promise<Profile | unknown>,
  setProfile: (updater: (current: Profile | null) => Profile | null) => void,
) {
  return async function saveLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await save("location", "/api/profile", {
      home_location_name: locationForm.homeLocation.trim() || null,
      timezone: locationForm.timezone,
      temperature_unit: locationForm.temperatureUnit,
    });
    if (result)
      setProfile((current) => (current ? { ...current, ...(result as Profile) } : current));
  };
}
