"use client";

import type { OutfitVariantMode, StudioVariant } from "../types";
import { MODE_DESCRIPTIONS, MODE_LABELS } from "./role-label.data";

type Props = {
  variants: readonly StudioVariant[];
  mode: OutfitVariantMode;
  onSelect: (mode: OutfitVariantMode) => void;
};

/**
 * A real tablist: arrow keys are handled by the browser's roving focus through
 * `tabindex`, and the selected state is carried by `aria-selected` rather than
 * by colour alone.
 */
export function RecommendationVariantTabs({ variants, mode, onSelect }: Props) {
  if (variants.length === 0) return null;

  return (
    <div aria-label="Look styles" className="variant-tabs" role="tablist">
      {variants.map((variant) => {
        const selected = variant.mode === mode;
        return (
          <button
            aria-controls="studio-stage"
            aria-selected={selected}
            className={`variant-tab${selected ? " variant-tab--on" : ""}`}
            id={`variant-tab-${variant.mode}`}
            key={variant.mode}
            onClick={() => onSelect(variant.mode)}
            role="tab"
            tabIndex={selected ? 0 : -1}
            type="button"
          >
            <span className="variant-tab__label">{MODE_LABELS[variant.mode]}</span>
            <span className="variant-tab__description">{MODE_DESCRIPTIONS[variant.mode]}</span>
          </button>
        );
      })}
    </div>
  );
}
