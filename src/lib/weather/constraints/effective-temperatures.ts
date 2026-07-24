import type { ForecastSnapshot, WeatherComfortProfile } from "../types";
import { classifyTemperature } from "./classify-temperature";
import { comfortAdjustment } from "./comfort-adjustment";
import { finiteOrUndefined, midpoint } from "./normalize";
import { warmthTargets } from "./warmth-targets";

export function computeEffectiveTemperatures(
  forecast: ForecastSnapshot,
  profile: WeatherComfortProfile,
) {
  const temperature = finiteOrUndefined(forecast.temperatureC);
  const feelsLike = finiteOrUndefined(forecast.feelsLikeC);
  const suppliedMinimum = finiteOrUndefined(forecast.minimumTemperatureC);
  const suppliedMaximum = finiteOrUndefined(forecast.maximumTemperatureC);
  const minimum =
    suppliedMinimum !== undefined && suppliedMaximum !== undefined
      ? Math.min(suppliedMinimum, suppliedMaximum)
      : suppliedMinimum;
  const maximum =
    suppliedMinimum !== undefined && suppliedMaximum !== undefined
      ? Math.max(suppliedMinimum, suppliedMaximum)
      : suppliedMaximum;
  const centralTemperature = feelsLike ?? temperature ?? midpoint(minimum, maximum);

  if (centralTemperature === undefined) {
    throw new Error("A temperature, feels-like temperature, or forecast range is required.");
  }

  const adjustment = comfortAdjustment(profile);
  const effectiveTemperatureC = centralTemperature + adjustment;
  const effectiveMinimumC =
    (minimum ?? effectiveTemperatureC) + (minimum === undefined ? 0 : adjustment);
  const effectiveMaximumC =
    (maximum ?? effectiveTemperatureC) + (maximum === undefined ? 0 : adjustment);
  const temperatureBand = classifyTemperature(effectiveTemperatureC);

  return {
    effectiveTemperatureC,
    effectiveMinimumC,
    effectiveMaximumC,
    temperatureBand,
    targets: warmthTargets(temperatureBand),
  };
}
