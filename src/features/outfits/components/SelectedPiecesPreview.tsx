import { GarmentArtwork } from "@/features/wardrobe/components/GarmentArtwork";
import type { WardrobeItemRole } from "@/features/wardrobe/types";

import { roleColors, roleLabels } from "./role-presentation.data";
import type { LiveWardrobeItem } from "./outfits-manager.types";

export function SelectedPiecesPreview({
  selectedEntries,
}: {
  selectedEntries: Array<{ role: WardrobeItemRole; item: LiveWardrobeItem }>;
}) {
  if (!selectedEntries.length) return null;
  return (
    <div className="outfit-builder-selected" aria-label="Selected outfit pieces">
      {selectedEntries.map(({ role, item }) => (
        <article key={item.id}>
          <GarmentArtwork
            category={role}
            color={item.primary_color_hex ?? roleColors[role].color}
            compact
          />
          <div>
            <span>{roleLabels[role]}</span>
            <strong>{item.name}</strong>
          </div>
        </article>
      ))}
    </div>
  );
}
