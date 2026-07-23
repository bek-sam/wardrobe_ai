import type { WardrobeItemRole } from "@/features/wardrobe/types";
import type { TemperatureBand } from "@/lib/weather";

// Distinct from recommendation/layering.ts, which numerically scores
// compile-time silhouette compatibility between already-selected items. This
// module instead judges whether the *number* of layers an outfit carries
// suits a given temperature band, for the curator's compact context.

const APPROPRIATE_LAYER_COUNT: Readonly<Record<TemperatureBand, readonly number[]>> = {
  extreme_hot: [0],
  hot: [0],
  warm: [0, 1],
  mild: [1],
  cool: [1, 2],
  cold: [2],
  extreme_cold: [2, 3],
};

export function evaluateLayerCount(
  layerCount: number,
  band: TemperatureBand,
): { appropriate: boolean; guidance: string } {
  const allowed = APPROPRIATE_LAYER_COUNT[band];
  if (allowed.includes(layerCount)) {
    return { appropriate: true, guidance: `${layerCount} layer(s) suits a ${band} day.` };
  }
  if (layerCount < Math.min(...allowed)) {
    return {
      appropriate: false,
      guidance: `Likely under-dressed for a ${band} day with only ${layerCount} layer(s).`,
    };
  }
  return {
    appropriate: false,
    guidance: `Likely over-dressed for a ${band} day with ${layerCount} layer(s).`,
  };
}

export function describeLayeringStrategy(
  items: readonly { role: WardrobeItemRole; warmthLevel: number | null }[],
): string {
  const layerItems = items.filter((item) => item.role === "layer");
  if (layerItems.length === 0) {
    return "No outer layer -- relies on the base top/bottom for warmth.";
  }
  const warmthValues = layerItems
    .map((item) => item.warmthLevel)
    .filter((v): v is number => v !== null);
  const averageWarmth = warmthValues.length
    ? warmthValues.reduce((sum, value) => sum + value, 0) / warmthValues.length
    : null;
  if (averageWarmth !== null && averageWarmth >= 4) {
    return "Heavy outer layer carries most of the outfit's warmth.";
  }
  return "Light-to-moderate outer layer supplements the base pieces.";
}
