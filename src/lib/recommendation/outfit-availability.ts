import type { AvailabilityStatus, WardrobeItem } from "@/features/wardrobe/types";

import { asCandidateMap } from "./planner-candidate-map";

export function getUnavailableItemIds(
  itemIds: readonly string[],
  candidates: ReadonlyMap<string, WardrobeItem> | readonly WardrobeItem[],
  allowedAvailabilityStatuses: readonly AvailabilityStatus[] = ["available"],
) {
  const candidateMap = asCandidateMap(candidates);
  const allowed = new Set(allowedAvailabilityStatuses);

  return itemIds.filter((itemId) => {
    const item = candidateMap.get(itemId);
    return (
      !item ||
      item.status !== "active" ||
      item.deleted_at !== null ||
      !allowed.has(item.availability_status)
    );
  });
}

export function isOutfitAvailable(
  itemIds: readonly string[],
  candidates: ReadonlyMap<string, WardrobeItem> | readonly WardrobeItem[],
  allowedAvailabilityStatuses: readonly AvailabilityStatus[] = ["available"],
) {
  return getUnavailableItemIds(itemIds, candidates, allowedAvailabilityStatuses).length === 0;
}
