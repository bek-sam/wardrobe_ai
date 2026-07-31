import type { StudioGarmentDetail, StudioVariantItem } from "../types";

/**
 * Adapts the flat lay's variant items into the same shape the try-on garment
 * chips use, so one chip list and one detail sheet serve both stages rather
 * than two parallel implementations that can drift apart.
 */
export function flatLayGarments(items: readonly StudioVariantItem[]): StudioGarmentDetail[] {
  return items.map((item) => ({
    itemId: item.itemId,
    role: item.role,
    sortOrder: item.sortOrder,
    hotspot: null,
    available: item.availabilityStatus === "available",
    item: {
      name: item.name,
      category: item.category,
      color_names: item.colorNames,
      pattern: item.pattern,
      availability_status: item.availabilityStatus,
      favorite: item.favorite,
      wear_count: item.wearCount,
    },
    cutoutUrl: null,
  }));
}
