import { artworkCategory, titleCase, wearNote } from "./insights-helpers";
import { colorValue } from "./color-value";
import type { RediscoverEntry } from "./rediscover-entry.types";
import type { InsightItem } from "./insights.types";

export function buildRediscoverEntries(items: InsightItem[]): RediscoverEntry[] {
  return items.map((item) => ({
    id: item.id,
    category: artworkCategory(item),
    color: colorValue(item.color_names[0] ?? "stone"),
    label: titleCase(item.category),
    name: item.name,
    detail: wearNote(item),
  }));
}
