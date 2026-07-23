import { RoleSelectField } from "./RoleSelectField";
import type { FoundationMode, LiveWardrobeItem, OutfitSelections } from "./outfits-manager.types";
import type { WardrobeItemRole } from "@/features/wardrobe/types";

export function RoleSelectGrid({
  activeRoles,
  foundation,
  itemsByRole,
  selections,
  onSelect,
  saving,
}: {
  activeRoles: WardrobeItemRole[];
  foundation: FoundationMode;
  itemsByRole: Record<WardrobeItemRole, LiveWardrobeItem[]>;
  selections: OutfitSelections;
  onSelect: (role: WardrobeItemRole, itemId: string) => void;
  saving: boolean;
}) {
  return (
    <div className="outfit-builder-role-grid">
      {activeRoles.map((role) => (
        <RoleSelectField
          items={itemsByRole[role]}
          key={role}
          onSelect={onSelect}
          required={
            role === "dress" ||
            (foundation === "separates" && (role === "top" || role === "bottom"))
          }
          role={role}
          saving={saving}
          value={selections[role]}
        />
      ))}
    </div>
  );
}
