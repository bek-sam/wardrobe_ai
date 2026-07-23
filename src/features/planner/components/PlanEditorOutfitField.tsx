import type { OutfitOption } from "./planner.types";

export function PlanEditorOutfitField({
  outfitId,
  onOutfitId,
  outfits,
}: {
  outfitId: string;
  onOutfitId: (value: string) => void;
  outfits: OutfitOption[];
}) {
  return (
    <label className="form-field">
      <span>Saved outfit</span>
      <select
        className="select-input"
        onChange={(event) => onOutfitId(event.target.value)}
        value={outfitId}
      >
        <option value="">Occasion only — no outfit yet</option>
        {outfits.map((outfit) => (
          <option key={outfit.id} value={outfit.id}>
            {outfit.name}
          </option>
        ))}
      </select>
    </label>
  );
}
