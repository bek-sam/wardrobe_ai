import { roleLabels } from "./role-presentation.data";
import type { LiveWardrobeItem, OutfitSelections } from "./outfits-manager.types";
import type { WardrobeItemRole } from "@/features/wardrobe/types";

export function RoleSelectField({
  role,
  required,
  items,
  value,
  onSelect,
  saving,
}: {
  role: WardrobeItemRole;
  required: boolean;
  items: LiveWardrobeItem[];
  value: OutfitSelections[WardrobeItemRole];
  onSelect: (role: WardrobeItemRole, itemId: string) => void;
  saving: boolean;
}) {
  return (
    <div className="form-field">
      <div className="form-field__label-row">
        <label htmlFor={`manual-outfit-${role}`}>{roleLabels[role]}</label>
        <span>{required ? "Required" : "Optional"}</span>
      </div>
      <select
        className="select-input"
        disabled={saving || items.length === 0}
        id={`manual-outfit-${role}`}
        onChange={(event) => onSelect(role, event.target.value)}
        required={required}
        value={value}
      >
        <option value="">
          {items.length
            ? `Select ${required ? "a" : "an optional"} ${roleLabels[role].toLowerCase()}`
            : `No available ${roleLabels[role].toLowerCase()}`}
        </option>
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
            {item.color_names[0] ? ` · ${item.color_names[0]}` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
