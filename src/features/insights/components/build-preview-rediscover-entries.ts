import type { WardrobePreviewItem } from "@/features/wardrobe/components/wardrobe-item-card.types";

import type { RediscoverEntry } from "./rediscover-entry.types";

export function buildPreviewRediscoverEntries(items: WardrobePreviewItem[]): RediscoverEntry[] {
  return items.slice(4, 7).map((item) => ({
    id: item.id,
    category: item.category,
    color: item.color,
    label: item.categoryLabel,
    name: item.name,
    detail: item.meta,
  }));
}
