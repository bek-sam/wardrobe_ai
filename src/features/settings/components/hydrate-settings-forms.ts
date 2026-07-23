import { objectString } from "./settings-helpers";
import type {
  LocationFormState,
  Profile,
  ProfileFormState,
  StyleFormState,
  StyleProfile,
} from "./settings.types";

export function hydrateProfileForm(profile: Profile): ProfileFormState {
  return {
    firstName: profile.first_name ?? "",
    displayName: profile.display_name ?? "",
    locale: profile.locale || "en-US",
  };
}

export function hydrateLocationForm(profile: Profile): LocationFormState {
  return {
    homeLocation: profile.home_location_name ?? "",
    timezone: profile.timezone || "America/Chicago",
    temperatureUnit: profile.temperature_unit || "fahrenheit",
  };
}

export function hydrateStyleForm(style: StyleProfile | null): StyleFormState {
  return {
    styles: style?.style_keywords ?? [],
    activities: style?.common_activities ?? [],
    favoriteColors: (style?.favorite_colors ?? []).join(", "),
    avoidedColors: (style?.avoided_colors ?? []).join(", "),
    preferredFits: (style?.preferred_fits ?? []).join(", "),
    topSize: objectString(style?.size_profile, "top"),
    bottomSize: objectString(style?.size_profile, "bottom"),
    dressSize: objectString(style?.size_profile, "dress"),
    shoeSize: objectString(style?.size_profile, "shoes"),
    coverageNotes: objectString(style?.modesty_preferences, "notes"),
    formality: style?.preferred_formality?.toString() ?? "",
    temperatureComfort: style?.runs_cold ? "cold" : style?.runs_hot ? "hot" : "neutral",
    styleNote: style?.notes ?? "",
  };
}
