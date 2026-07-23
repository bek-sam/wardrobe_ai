import { useState } from "react";

import { deleteOutfit, markOutfitWorn, toggleFavoriteOutfit } from "./outfit-card-operations";
import type { OutfitFilter, OutfitRecord } from "./outfits-manager.types";

export function useOutfitCardActions(
  setOutfits: (updater: (current: OutfitRecord[]) => OutfitRecord[]) => void,
  setTotal: (updater: (current: number) => number) => void,
  activeFilter: OutfitFilter,
) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function mutate(outfitId: string, operation: () => Promise<void>) {
    setBusyId(outfitId);
    setError(null);
    setNotice(null);
    try {
      await operation();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The outfit could not be updated.");
    } finally {
      setBusyId(null);
    }
  }

  const setters = { setOutfits, setTotal, setNotice };
  return {
    busyId,
    error,
    notice,
    setNotice,
    toggleFavorite: (outfit: OutfitRecord) =>
      mutate(outfit.id, () => toggleFavoriteOutfit(outfit, activeFilter, setters)),
    markWorn: (outfit: OutfitRecord) => mutate(outfit.id, () => markOutfitWorn(outfit, setters)),
    remove: (outfit: OutfitRecord) => {
      if (!window.confirm(`Delete “${outfit.name}”? This does not delete its wardrobe items.`))
        return;
      void mutate(outfit.id, () => deleteOutfit(outfit, setters));
    },
  };
}
