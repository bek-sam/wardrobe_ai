import { asPreview } from "./outfit-preview-mapping";
import { OutfitCard } from "./OutfitCard";
import { OutfitCardActionButtons } from "./OutfitCardActionButtons";
import type { OutfitRecord } from "./outfits-manager.types";
import type { useOutfitCardActions } from "./use-outfit-card-actions";

export function OutfitsGrid({
  outfits,
  actions,
}: {
  outfits: OutfitRecord[];
  actions: ReturnType<typeof useOutfitCardActions>;
}) {
  return (
    <section className="outfit-grid" aria-label="Saved outfits">
      {outfits.map((outfit) => {
        const busy = actions.busyId === outfit.id;
        return (
          <OutfitCard
            actions={
              <OutfitCardActionButtons
                busy={busy}
                onDelete={() => actions.remove(outfit)}
                onMarkWorn={() => void actions.markWorn(outfit)}
                onToggleFavorite={() => void actions.toggleFavorite(outfit)}
                outfit={outfit}
              />
            }
            key={outfit.id}
            outfit={asPreview(outfit)}
          />
        );
      })}
    </section>
  );
}
