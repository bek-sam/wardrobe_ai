import type { GeneratedOutfit } from "@/features/outfits/types";
import type { WardrobeItem } from "@/features/wardrobe/types";

import { validateOutfitItem } from "./validate-item";
import type { OutfitValidationIssue, OutfitValidationOptions } from "./types";

export function resolveOutfitItems(
  selections: readonly GeneratedOutfit["items"][number][],
  candidates: ReadonlyMap<string, WardrobeItem>,
  options: OutfitValidationOptions,
  allowedAvailability: ReadonlySet<string>,
): { issues: OutfitValidationIssue[]; resolvedItems: WardrobeItem[] } {
  const issues: OutfitValidationIssue[] = [];
  const resolvedItems: WardrobeItem[] = [];

  for (const selection of selections) {
    const item = candidates.get(selection.item_id);
    if (!item) {
      issues.push({
        code: "unknown_item",
        itemId: selection.item_id,
        message: "The outfit selected an item outside the supplied owned-item candidates.",
      });
      continue;
    }
    issues.push(...validateOutfitItem(item, selection, options, allowedAvailability));
    resolvedItems.push(item);
  }

  return { issues, resolvedItems };
}
