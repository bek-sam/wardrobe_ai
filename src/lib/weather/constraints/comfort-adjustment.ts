import type { WeatherComfortProfile } from "../types";

export function comfortAdjustment(profile: WeatherComfortProfile) {
  if (profile.runsCold && !profile.runsHot) return -3;
  if (profile.runsHot && !profile.runsCold) return 3;
  return 0;
}
