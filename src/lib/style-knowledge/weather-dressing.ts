import type { TemperatureBand } from "@/lib/weather";

const BAND_GUIDANCE: Readonly<Record<TemperatureBand, string>> = {
  extreme_cold: "Prioritize insulation and full coverage; minimize exposed skin.",
  cold: "A substantial outer layer and warm base pieces are expected.",
  cool: "A light-to-medium layer is usually welcome.",
  mild: "Most single-layer outfits are comfortable.",
  warm: "Breathable fabrics and minimal layering.",
  hot: "Lightweight, breathable, and minimal coverage.",
  extreme_hot: "Loose, breathable fabrics; avoid dark heat-absorbing colors if outdoors.",
};

export function weatherDressingGuidance(band: TemperatureBand, rain: boolean): string {
  const base = BAND_GUIDANCE[band];
  return rain
    ? `${base} Rain expected -- prioritize water-resistant outerwear and footwear.`
    : base;
}

export function evaluateWeatherAppropriateness(
  warmthLevel: number,
  band: TemperatureBand,
): { appropriate: boolean; guidance: string } {
  const targets: Record<TemperatureBand, number> = {
    extreme_cold: 5,
    cold: 4,
    cool: 3,
    mild: 2.5,
    warm: 2,
    hot: 1,
    extreme_hot: 1,
  };
  const target = targets[band];
  const delta = Math.abs(warmthLevel - target);
  return {
    appropriate: delta <= 1,
    guidance:
      delta <= 1
        ? `Warmth level suits a ${band} day.`
        : warmthLevel < target
          ? `Likely too light for a ${band} day.`
          : `Likely too warm for a ${band} day.`,
  };
}
