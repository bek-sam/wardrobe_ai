"use client";

import type { StudioMode } from "../hooks/studio-mode";

const MODES: { value: StudioMode; label: string; hint: string }[] = [
  { value: "flat-lay", label: "Flat lay", hint: "Your real pieces, instantly" },
  { value: "try-on", label: "AI try-on", hint: "Generated on request" },
];

/**
 * Switching modes never discards the selection, the locks, or an in-flight
 * generation — the studio state lives above this control.
 */
export function StageModeTabs({
  mode,
  onSelect,
}: {
  mode: StudioMode;
  onSelect: (mode: StudioMode) => void;
}) {
  return (
    <div aria-label="View" className="stage-tabs" role="tablist">
      {MODES.map((entry) => {
        const selected = entry.value === mode;
        return (
          <button
            aria-selected={selected}
            className={`stage-tab${selected ? " stage-tab--on" : ""}`}
            key={entry.value}
            onClick={() => onSelect(entry.value)}
            role="tab"
            tabIndex={selected ? 0 : -1}
            type="button"
          >
            <span className="stage-tab__label">{entry.label}</span>
            <span className="stage-tab__hint">{entry.hint}</span>
          </button>
        );
      })}
    </div>
  );
}
