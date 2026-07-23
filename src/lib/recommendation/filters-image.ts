import type { WardrobeItem } from "@/features/wardrobe/types";

import type { HardFilterContext, HardFilterReason } from "./filters.types";

export function imageRequiredReasons(
  item: WardrobeItem,
  context: HardFilterContext,
): HardFilterReason[] {
  if (!context.requireImage) return [];
  const imageIds =
    context.itemIdsWithImages instanceof Set
      ? context.itemIdsWithImages
      : new Set(context.itemIdsWithImages ?? []);
  return imageIds.has(item.id)
    ? []
    : [{ code: "image_required", message: "This operation requires an item image." }];
}
