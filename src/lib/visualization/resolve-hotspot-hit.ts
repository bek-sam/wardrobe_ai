import { hotspotArea, hotspotContains } from "./hotspot-geometry";
import type { GarmentHotspot, NormalizedPoint } from "./types";

/**
 * A region must be this much smaller than the next candidate before being
 * treated as "materially more specific"; otherwise two comparably sized
 * overlapping layers are genuinely ambiguous and the user picks.
 */
const SPECIFICITY_RATIO = 0.7;

export type HotspotHit =
  | { kind: "none" }
  | { kind: "single"; hotspot: GarmentHotspot }
  | { kind: "ambiguous"; hotspots: GarmentHotspot[] };

/**
 * Resolves a pointer hit over possibly overlapping garment regions:
 * highest zIndex first, then a materially smaller region wins as the more
 * specific target. Two plausible layers of similar size stay ambiguous so the
 * caller can show a "Which layer?" chooser rather than guessing.
 */
export function resolveHotspotHit(
  hotspots: readonly GarmentHotspot[],
  point: NormalizedPoint,
): HotspotHit {
  const containing = hotspots.filter((hotspot) => hotspotContains(hotspot, point));
  if (containing.length === 0) return { kind: "none" };
  if (containing.length === 1) return { kind: "single", hotspot: containing[0] as GarmentHotspot };

  const ranked = [...containing].sort(
    (first, second) => second.zIndex - first.zIndex || hotspotArea(first) - hotspotArea(second),
  );
  const [top, next] = ranked as [GarmentHotspot, GarmentHotspot];
  if (top.zIndex > next.zIndex) return { kind: "single", hotspot: top };
  if (hotspotArea(top) <= hotspotArea(next) * SPECIFICITY_RATIO) {
    return { kind: "single", hotspot: top };
  }
  return { kind: "ambiguous", hotspots: ranked };
}
