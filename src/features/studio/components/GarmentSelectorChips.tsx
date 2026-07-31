"use client";

import { ROLE_LABELS } from "./role-label.data";
import type { StudioGarmentDetail } from "../types";

type Props = {
  garments: readonly StudioGarmentDetail[];
  selectedItemId: string | null;
  onSelect: (itemId: string) => void;
};

/**
 * The accessible equivalent of clicking the image, and the reason the feature
 * still works when every hotspot is approximate. Real buttons, reachable with
 * Tab/Shift+Tab and activated with Enter/Space — no arrow-key emulation, no
 * pointer precision, and no dependence on localization succeeding.
 */
export function GarmentSelectorChips({ garments, selectedItemId, onSelect }: Props) {
  if (garments.length === 0) return null;

  return (
    <div className="garment-chips">
      <p className="garment-chips__label" id="garment-chips-label">
        Pieces in this look
      </p>
      <ul aria-labelledby="garment-chips-label" className="garment-chips__list">
        {garments.map((garment) => {
          const name = (garment.item?.name as string) ?? "Removed piece";
          const selected = garment.itemId === selectedItemId;
          return (
            <li key={garment.itemId}>
              <button
                aria-pressed={selected}
                className={`garment-chip${selected ? " garment-chip--selected" : ""}`}
                onClick={() => onSelect(garment.itemId)}
                type="button"
              >
                <span className="garment-chip__role">{ROLE_LABELS[garment.role]}</span>
                <span className="garment-chip__name">{name}</span>
                {selected ? <span className="sr-only">(selected)</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
