import { describe, expect, it } from "vitest";

import { classifyTemperature, deriveClothingConstraints } from "@/lib/weather";

describe("weather-to-clothing constraints", () => {
  it("derives cold, rain, wind, and snow requirements", () => {
    const constraints = deriveClothingConstraints(
      {
        temperatureC: 4,
        feelsLikeC: 1,
        minimumTemperatureC: -1,
        maximumTemperatureC: 6,
        precipitationProbability: 75,
        snowfallCm: 1,
        windSpeedKph: 31,
      },
      { runsCold: true },
    );

    expect(constraints.effectiveTemperatureC).toBe(-2);
    expect(constraints.temperatureBand).toBe("cold");
    expect(constraints.needsInsulation).toBe(true);
    expect(constraints.tags).toEqual(
      expect.arrayContaining([
        "needs_outer_layer",
        "needs_insulation",
        "wind_protection",
        "rain_protection",
        "snow_safe_footwear",
      ]),
    );
  });

  it("prioritizes breathability and avoids heavy layers in heat", () => {
    const constraints = deriveClothingConstraints({
      minimumTemperatureC: 26,
      maximumTemperatureC: 34,
      humidityPercent: 82,
    });

    expect(constraints.temperatureBand).toBe("hot");
    expect(constraints.maximumItemWarmth).toBe(2);
    expect(constraints.breathablePriority).toBe(true);
    expect(constraints.avoidHeavyLayers).toBe(true);
  });

  it("recommends a flexible layer for a large day-to-night swing", () => {
    const constraints = deriveClothingConstraints({
      minimumTemperatureC: 12,
      maximumTemperatureC: 24,
      spansDayAndNight: true,
    });

    expect(constraints.dayNightLayerRecommended).toBe(true);
    expect(constraints.tags).toContain("day_night_layer");
  });

  it("normalizes an accidentally reversed forecast range", () => {
    const constraints = deriveClothingConstraints({
      minimumTemperatureC: 24,
      maximumTemperatureC: 12,
    });

    expect(constraints.effectiveMinimumC).toBe(12);
    expect(constraints.effectiveMaximumC).toBe(24);
  });

  it("rejects forecasts without any usable temperature", () => {
    expect(() => deriveClothingConstraints({ precipitationProbability: 80 })).toThrow(
      /temperature/i,
    );
    expect(classifyTemperature(36)).toBe("extreme_hot");
  });
});
