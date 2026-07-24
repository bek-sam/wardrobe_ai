import type { ClothingConstraints, ForecastSnapshot, WeatherComfortProfile } from "../types";
import { deriveConstraintFlags } from "./derive-tags";
import { computeEffectiveTemperatures } from "./effective-temperatures";

export function deriveClothingConstraints(
  forecast: ForecastSnapshot,
  profile: WeatherComfortProfile = {},
): ClothingConstraints {
  const { effectiveTemperatureC, effectiveMinimumC, effectiveMaximumC, temperatureBand, targets } =
    computeEffectiveTemperatures(forecast, profile);
  const flags = deriveConstraintFlags(forecast, effectiveMinimumC, effectiveMaximumC);

  return {
    effectiveTemperatureC,
    effectiveMinimumC,
    effectiveMaximumC,
    temperatureBand,
    ...targets,
    ...flags,
  };
}
