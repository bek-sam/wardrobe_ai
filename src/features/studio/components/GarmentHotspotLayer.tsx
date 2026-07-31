"use client";

import {
  hotspotBounds,
  projectNormalizedRect,
  type GarmentHotspot,
  type Size,
} from "@/lib/visualization";

import { ROLE_LABELS } from "./role-label.data";

type Props = {
  hotspots: readonly GarmentHotspot[];
  natural: Size;
  container: Size;
  selectedItemId: string | null;
  nameFor: (itemId: string) => string;
};

/**
 * Purely decorative: the outlines mirror the current selection so a sighted
 * pointer user gets feedback, while the actual hit handling lives on the image
 * and the accessible selection lives in the chip list. `aria-hidden` keeps this
 * out of the accessibility tree so a screen reader is not read a second,
 * duplicate set of garments.
 */
export function GarmentHotspotLayer({
  hotspots,
  natural,
  container,
  selectedItemId,
  nameFor,
}: Props) {
  return (
    <div className="tryon__hotspots" aria-hidden="true">
      {hotspots.map((hotspot) => {
        const rect = projectNormalizedRect(hotspotBounds(hotspot), natural, container);
        const active = hotspot.itemId === selectedItemId;
        return (
          <span
            className={`tryon__hotspot${active ? " tryon__hotspot--active" : ""}`}
            key={hotspot.itemId}
            style={{
              left: `${rect.left}px`,
              top: `${rect.top}px`,
              width: `${rect.width}px`,
              height: `${rect.height}px`,
              zIndex: hotspot.zIndex,
            }}
          >
            {active ? (
              <span className="tryon__hotspot-chip">
                {ROLE_LABELS[hotspot.role]} · {nameFor(hotspot.itemId)}
              </span>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}
