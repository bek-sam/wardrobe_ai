import type {
  OutfitVisualizationProvider,
  VisualizationGarmentInput,
} from "@/lib/ai/visualization-provider";
import {
  buildSnapshotHotspots,
  VISUALIZATION_ROLE_Z_INDEX,
  type GarmentHotspot,
} from "@/lib/visualization";

/**
 * Localization is best-effort by design. A failure, an empty result, or a
 * low-confidence region degrades to the deterministic body zone; the garment
 * chip list is unaffected either way, so the feature stays fully usable even
 * when every hotspot is approximate.
 */
export async function locateGarmentHotspots(
  provider: OutfitVisualizationProvider,
  input: {
    userId: string;
    image: Buffer;
    identity: Buffer;
    garments: readonly VisualizationGarmentInput[];
  },
): Promise<GarmentHotspot[]> {
  const located = await provider
    .localize(input)
    .then((result) =>
      result.regions.map((region): GarmentHotspot => ({
        version: 1,
        itemId: region.itemId,
        role: region.role,
        shape: "rect",
        bounds: region.bounds,
        confidence: region.confidence,
        // Never "user_corrected": a model region is a proposal, and calling
        // it confirmed would let generated pixels masquerade as user intent.
        source: "model",
        zIndex: VISUALIZATION_ROLE_Z_INDEX[region.role],
      })),
    )
    .catch(() => []);

  const supplied = new Set(input.garments.map((garment) => garment.itemId));
  return buildSnapshotHotspots(
    input.garments.map(({ itemId, role }) => ({ itemId, role })),
    located.filter((hotspot) => supplied.has(hotspot.itemId)),
  );
}
