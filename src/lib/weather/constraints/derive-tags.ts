import type { ForecastSnapshot } from "../types";
import { buildConstraintTags } from "./build-tags";
import { clamp, finiteOrUndefined } from "./normalize";

export function deriveConstraintFlags(
  forecast: ForecastSnapshot,
  effectiveMinimumC: number,
  effectiveMaximumC: number,
) {
  const precipitationProbability = clamp(
    finiteOrUndefined(forecast.precipitationProbability) ?? 0,
    0,
    100,
  );
  const precipitationMm = Math.max(finiteOrUndefined(forecast.precipitationMm) ?? 0, 0);
  const snowfallCm = Math.max(finiteOrUndefined(forecast.snowfallCm) ?? 0, 0);
  const windSpeedKph = Math.max(finiteOrUndefined(forecast.windSpeedKph) ?? 0, 0);
  const humidityPercent = clamp(finiteOrUndefined(forecast.humidityPercent) ?? 0, 0, 100);

  const rainProtectionRequired =
    precipitationProbability >= 40 || precipitationMm >= 0.5 || snowfallCm > 0;
  const windProtectionRequired = windSpeedKph >= 25;
  const flags = {
    needsOuterLayer: effectiveMinimumC < 16 || windProtectionRequired,
    needsInsulation: effectiveMinimumC < 5,
    windProtectionRequired,
    rainProtectionRequired,
    rainSafeShoesRequired: rainProtectionRequired,
    snowSafeFootwearRequired: snowfallCm > 0,
    breathablePriority:
      effectiveMaximumC >= 24 || (effectiveMaximumC >= 20 && humidityPercent >= 70),
    avoidHeavyLayers: effectiveMaximumC >= 25,
    dayNightLayerRecommended: Boolean(
      forecast.spansDayAndNight && effectiveMaximumC - effectiveMinimumC >= 7,
    ),
  };

  return { ...flags, tags: buildConstraintTags(flags) };
}
