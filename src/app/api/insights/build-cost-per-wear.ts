import type { InsightItem } from "./types";

export function buildCostPerWear(items: readonly InsightItem[]) {
  return items
    .filter((item) => item.purchase_price !== null && item.wear_count > 0)
    .map((item) => ({
      itemId: item.id,
      name: item.name,
      value: Number(item.purchase_price) / item.wear_count,
      currency: item.currency,
    }))
    .sort((first, second) => first.value - second.value);
}
