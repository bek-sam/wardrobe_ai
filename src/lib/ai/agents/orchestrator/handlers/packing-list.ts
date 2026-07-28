import type { ClothingConstraintTag } from "@/lib/weather/types";

import type { PackingListEntry, PlanDayView } from "../answers.types";
import { PACKING_ESSENTIAL_NOTES, PACKING_ROLE_ORDER } from "./packing-notes.data";

/** One row per distinct item, counting how many days of the trip use it. */
export function buildPackingList(views: readonly PlanDayView[]): PackingListEntry[] {
  const byItem = new Map<string, PackingListEntry>();
  for (const view of views) {
    for (const item of view.items) {
      const existing = byItem.get(item.item_id);
      if (existing) existing.dayCount += 1;
      else {
        byItem.set(item.item_id, {
          itemId: item.item_id,
          name: item.name,
          role: item.role,
          category: item.category,
          dayCount: 1,
        });
      }
    }
  }

  return [...byItem.values()].sort(
    (first, second) =>
      PACKING_ROLE_ORDER.indexOf(first.role) - PACKING_ROLE_ORDER.indexOf(second.role) ||
      second.dayCount - first.dayCount ||
      first.name.localeCompare(second.name),
  );
}

export function buildPackingEssentials(views: readonly PlanDayView[]) {
  const tags = new Set<ClothingConstraintTag>();
  for (const view of views) {
    for (const tag of view.weather?.tags ?? []) tags.add(tag as ClothingConstraintTag);
  }
  return [...tags]
    .map((tag) => PACKING_ESSENTIAL_NOTES[tag])
    .filter((note): note is string => Boolean(note));
}
