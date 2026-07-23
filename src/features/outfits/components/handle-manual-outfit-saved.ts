import type { useOutfitsManagerState } from "./use-outfits-manager-state";
import type { OutfitRecord } from "./outfits-manager.types";

export function handleManualOutfitSaved(
  state: ReturnType<typeof useOutfitsManagerState>,
  saved: OutfitRecord,
) {
  state.setBuilderOpen(false);
  state.actions.setNotice(`“${saved.name}” was saved to your outfits.`);
  if (state.activeFilter === "all") {
    state.setOutfits((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
    state.setTotal((current) => current + 1);
  } else {
    state.setActiveFilter("all");
  }
}
