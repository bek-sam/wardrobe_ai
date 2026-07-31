"use client";

import { useState } from "react";

import type { GarmentHotspot, Size } from "@/lib/visualization";

import type { StudioGarmentDetail } from "../types";
import { useHotspotPointer } from "./use-hotspot-pointer";

/**
 * Hit-testing and the ambiguity chooser. Deliberately holds no ref: the
 * container ref stays in the component so this object can be destructured
 * freely without dragging a ref through render.
 */
export function useInteractiveImage(
  garments: readonly StudioGarmentDetail[],
  natural: Size | null,
  container: Size | null,
  onSelect: (itemId: string) => void,
) {
  const [ambiguous, setAmbiguous] = useState<GarmentHotspot[] | null>(null);
  const hotspots = garments.flatMap((garment) => (garment.hotspot ? [garment.hotspot] : []));

  const choose = (itemId: string) => {
    setAmbiguous(null);
    onSelect(itemId);
  };
  const onPointer = useHotspotPointer({
    hotspots,
    natural,
    container,
    onSelect: choose,
    onAmbiguous: setAmbiguous,
  });

  return {
    hotspots,
    ambiguous,
    choose,
    onPointer,
    dismissChooser: () => setAmbiguous(null),
    nameFor: (itemId: string) =>
      (garments.find((garment) => garment.itemId === itemId)?.item?.name as string) ?? "this piece",
  };
}
