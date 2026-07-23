import { useState } from "react";

import { useOutfitCardActions } from "./use-outfit-card-actions";
import { useOutfitsFetch } from "./use-outfits-fetch";
import { useOutfitsFilterSort } from "./use-outfits-filter-sort";
import type { OutfitFilter } from "./outfits-manager.types";

export function useOutfitsManagerState(configured: boolean) {
  const [activeFilter, setActiveFilter] = useState<OutfitFilter>("all");
  const [builderOpen, setBuilderOpen] = useState(false);

  const fetchState = useOutfitsFetch(configured, activeFilter);
  const filterSort = useOutfitsFilterSort(fetchState.outfits, activeFilter);
  const actions = useOutfitCardActions(fetchState.setOutfits, fetchState.setTotal, activeFilter);

  return {
    activeFilter,
    setActiveFilter,
    builderOpen,
    setBuilderOpen,
    ...fetchState,
    ...filterSort,
    actions,
  };
}
