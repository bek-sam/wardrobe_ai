import { useState } from "react";

import { resolveWardrobeItemRole } from "@/lib/recommendation/item-role";
import type { WardrobeItemRole } from "@/features/wardrobe/types";

import { emptySelections } from "./role-presentation.data";
import type { FoundationMode, LiveWardrobeItem, OutfitSelections } from "./outfits-manager.types";

export function useOutfitSelections(items: LiveWardrobeItem[]) {
  const [foundation, setFoundation] = useState<FoundationMode>("separates");
  const [selections, setSelections] = useState<OutfitSelections>(emptySelections);

  function chooseFoundation(next: FoundationMode) {
    setFoundation(next);
    setSelections((current) =>
      next === "dress" ? { ...current, top: "", bottom: "" } : { ...current, dress: "" },
    );
  }

  const activeRoles: WardrobeItemRole[] =
    foundation === "dress"
      ? ["dress", "layer", "shoes", "accessory"]
      : ["top", "bottom", "layer", "shoes", "accessory"];
  const selectedEntries = activeRoles
    .map((role) => ({ role, item: items.find((item) => item.id === selections[role]) ?? null }))
    .filter(
      (entry): entry is { role: WardrobeItemRole; item: LiveWardrobeItem } => entry.item !== null,
    );
  const unresolvedCount = items.filter((item) => !resolveWardrobeItemRole(item)).length;
  const missingFoundation =
    foundation === "dress" ? !selections.dress : !selections.top || !selections.bottom;
  const selectedIds = selectedEntries.map((entry) => entry.item.id);
  const hasDuplicate = new Set(selectedIds).size !== selectedIds.length;

  return {
    foundation,
    setFoundation,
    chooseFoundation,
    selections,
    setSelections,
    activeRoles,
    selectedEntries,
    unresolvedCount,
    missingFoundation,
    hasDuplicate,
  };
}
