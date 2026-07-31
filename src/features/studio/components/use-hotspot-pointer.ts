"use client";

import { useCallback } from "react";

import {
  pointToNormalized,
  resolveHotspotHit,
  type GarmentHotspot,
  type Size,
} from "@/lib/visualization";

type Options = {
  hotspots: readonly GarmentHotspot[];
  natural: Size | null;
  container: Size | null;
  onSelect: (itemId: string) => void;
  onAmbiguous: (hotspots: GarmentHotspot[]) => void;
};

/**
 * Maps a click on the displayed image back to a garment. A click in the
 * letterbox bars resolves to nothing rather than to the nearest region, and
 * two comparably sized overlapping layers open the chooser instead of the
 * component guessing which one the user meant.
 */
export function useHotspotPointer({
  hotspots,
  natural,
  container,
  onSelect,
  onAmbiguous,
}: Options) {
  return useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (!natural || !container) return;
      const box = event.currentTarget.getBoundingClientRect();
      const point = pointToNormalized(
        { x: event.clientX - box.left, y: event.clientY - box.top },
        natural,
        container,
      );
      if (!point) return;

      const hit = resolveHotspotHit(hotspots, point);
      if (hit.kind === "single") onSelect(hit.hotspot.itemId);
      else if (hit.kind === "ambiguous") onAmbiguous(hit.hotspots);
    },
    [hotspots, natural, container, onSelect, onAmbiguous],
  );
}
