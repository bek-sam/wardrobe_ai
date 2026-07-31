import { VISUALIZATION_ROLE_Z_INDEX } from "./constants.data";
import { FALLBACK_BODY_ZONES, HOTSPOT_AREA_BOUNDS } from "./fallback-hotspots.data";
import { hotspotArea } from "./hotspot-geometry";
import type { GarmentHotspot, VisualizationSnapshotItem } from "./types";

/** Below this the model's own region is not trustworthy enough to show. */
export const HOTSPOT_MIN_CONFIDENCE = 0.4;

function withinRoleAreaBounds(hotspot: GarmentHotspot): boolean {
  const bounds = HOTSPOT_AREA_BOUNDS[hotspot.role];
  const area = hotspotArea(hotspot);
  return area >= bounds.min && area <= bounds.max;
}

export function isUsableHotspot(hotspot: GarmentHotspot): boolean {
  return hotspot.confidence >= HOTSPOT_MIN_CONFIDENCE && withinRoleAreaBounds(hotspot);
}

export function fallbackHotspot(
  item: Pick<VisualizationSnapshotItem, "itemId" | "role">,
): GarmentHotspot {
  return {
    version: 1,
    itemId: item.itemId,
    role: item.role,
    shape: "rect",
    bounds: FALLBACK_BODY_ZONES[item.role],
    confidence: 0,
    source: "fallback",
    zIndex: VISUALIZATION_ROLE_Z_INDEX[item.role],
  };
}

/**
 * One hotspot per snapshot item, always. A model region that is missing,
 * low-confidence, or an implausible size for its role degrades to the
 * deterministic body zone rather than dropping the garment out of the image
 * entirely — the chip list stays complete either way.
 */
export function buildSnapshotHotspots(
  items: readonly Pick<VisualizationSnapshotItem, "itemId" | "role">[],
  located: readonly GarmentHotspot[],
): GarmentHotspot[] {
  const usableByItemId = new Map(
    located.filter(isUsableHotspot).map((hotspot) => [hotspot.itemId, hotspot]),
  );
  return items.map((item) => usableByItemId.get(item.itemId) ?? fallbackHotspot(item));
}
