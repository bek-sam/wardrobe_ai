import type { FoundationMode } from "./outfits-manager.types";

export function FoundationPicker({
  foundation,
  onChoose,
  saving,
}: {
  foundation: FoundationMode;
  onChoose: (mode: FoundationMode) => void;
  saving: boolean;
}) {
  return (
    <fieldset className="settings-fieldset" disabled={saving}>
      <legend>Choose a foundation</legend>
      <div className="choice-grid">
        <label className="choice-chip">
          <input
            checked={foundation === "separates"}
            name="outfit-foundation"
            onChange={() => onChoose("separates")}
            type="radio"
          />
          <span>Top + bottom</span>
        </label>
        <label className="choice-chip">
          <input
            checked={foundation === "dress"}
            name="outfit-foundation"
            onChange={() => onChoose("dress")}
            type="radio"
          />
          <span>Dress</span>
        </label>
      </div>
    </fieldset>
  );
}
