import { useEffect } from "react";

import { resolveWardrobeItemRole } from "@/lib/recommendation/item-role";

import { outfitValidationMessage } from "./outfit-validation-message";
import { useAvailableWardrobeItems } from "./use-available-wardrobe-items";
import { useManualOutfitSubmit } from "./use-manual-outfit-submit";
import { useOutfitSelections } from "./use-outfit-selections";
import type { OutfitRecord } from "./outfits-manager.types";

export function useManualOutfitDialog(onSaved: (outfit: OutfitRecord) => void) {
  const wardrobe = useAvailableWardrobeItems(() => {});
  const selections = useOutfitSelections(wardrobe.items);
  const form = useManualOutfitSubmit(onSaved, selections.selectedEntries);

  useEffect(() => {
    if (!wardrobe.items.length) return;
    const roles = wardrobe.items.map((item) => resolveWardrobeItemRole(item));
    if ((!roles.includes("top") || !roles.includes("bottom")) && roles.includes("dress")) {
      selections.setFoundation("dress");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wardrobe.items]);

  const validationMessage = outfitValidationMessage(
    form.name,
    selections.missingFoundation,
    selections.foundation,
    selections.hasDuplicate,
  );

  return { wardrobe, selections, form, validationMessage };
}
