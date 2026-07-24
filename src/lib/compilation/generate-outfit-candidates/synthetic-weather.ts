import { warmthTargets, type ClothingConstraints, type TemperatureBand } from "@/lib/weather";

import { BAND_REPRESENTATIVE_TEMPERATURE_C } from "./constants.data";

/**
 * A synthetic (non-forecast) ClothingConstraints used only to bias which
 * layer/shoe/accessory a compile-time variant prefers, so the library holds
 * genuinely different item picks per weather condition instead of one
 * candidate re-tagged five ways. Distinct from deriveClothingConstraints(),
 * which turns a real Open-Meteo forecast into constraints at retrieval time.
 */
function syntheticWeatherConstraints(band: TemperatureBand, rain: boolean): ClothingConstraints {
  const targets = warmthTargets(band);
  const isCold = band === "cold" || band === "extreme_cold";
  const isHot = band === "hot" || band === "extreme_hot";
  const temperatureC = BAND_REPRESENTATIVE_TEMPERATURE_C[band];
  return {
    effectiveTemperatureC: temperatureC,
    effectiveMinimumC: temperatureC,
    effectiveMaximumC: temperatureC,
    temperatureBand: band,
    ...targets,
    needsOuterLayer: isCold,
    needsInsulation: band === "extreme_cold",
    windProtectionRequired: false,
    rainProtectionRequired: rain,
    rainSafeShoesRequired: rain,
    snowSafeFootwearRequired: false,
    breathablePriority: isHot,
    avoidHeavyLayers: isHot,
    dayNightLayerRecommended: false,
    tags: rain ? ["rain_protection", "rain_safe_shoes"] : [],
  };
}

// The five weather conditions the spec calls out by name. "rain" biases
// toward rain-safe shoes/layers at a mild temperature rather than a fixed
// band of its own, since precipitation is orthogonal to temperature.
export const WEATHER_VARIANT_CONTEXTS: readonly { weather: ClothingConstraints }[] = [
  { weather: syntheticWeatherConstraints("cold", false) },
  { weather: syntheticWeatherConstraints("mild", false) },
  { weather: syntheticWeatherConstraints("warm", false) },
  { weather: syntheticWeatherConstraints("hot", false) },
  { weather: syntheticWeatherConstraints("mild", true) },
];
