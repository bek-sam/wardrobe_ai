"use client";

import type { GarmentHotspot } from "@/lib/visualization";

import { ROLE_LABELS } from "./role-label.data";

type Props = {
  hotspots: readonly GarmentHotspot[];
  nameFor: (itemId: string) => string;
  onChoose: (itemId: string) => void;
  onDismiss: () => void;
};

/**
 * Shown only when two comparably sized layers genuinely overlap under the
 * pointer — an open coat over the top beneath it. Asking is better than
 * silently picking the outer layer and hiding the inner one.
 */
export function LayerChooser({ hotspots, nameFor, onChoose, onDismiss }: Props) {
  return (
    <div className="layer-chooser" role="dialog" aria-label="Which layer did you mean?">
      <p className="layer-chooser__title">Which layer?</p>
      <ul className="layer-chooser__list">
        {hotspots.map((hotspot) => (
          <li key={hotspot.itemId}>
            <button onClick={() => onChoose(hotspot.itemId)} type="button">
              <span className="layer-chooser__role">{ROLE_LABELS[hotspot.role]}</span>
              <span className="layer-chooser__name">{nameFor(hotspot.itemId)}</span>
            </button>
          </li>
        ))}
      </ul>
      <button className="layer-chooser__dismiss" onClick={onDismiss} type="button">
        Cancel
      </button>
    </div>
  );
}
