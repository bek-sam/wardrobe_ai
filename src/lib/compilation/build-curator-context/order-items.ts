import type { WardrobeItem } from "@/features/wardrobe/types";
import type { GeneratedOutfitCandidate } from "@/lib/compilation/generate-outfit-candidates";

export type OrderedItem = { entry: GeneratedOutfitCandidate["items"][number]; item: WardrobeItem };

export function orderCandidateItems(
  candidate: GeneratedOutfitCandidate,
  resolvedItems: readonly WardrobeItem[],
): OrderedItem[] {
  const itemsById = new Map(resolvedItems.map((item) => [item.id, item]));
  return candidate.items
    .map((entry) => ({ entry, item: itemsById.get(entry.itemId) }))
    .filter((pair): pair is OrderedItem => pair.item !== undefined);
}
