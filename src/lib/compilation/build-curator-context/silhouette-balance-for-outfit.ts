import { classifySilhouetteWeight, evaluateSilhouetteBalance } from "@/lib/style-knowledge";

import type { OrderedItem } from "./order-items";

export function silhouetteBalanceForOutfit(orderedItems: readonly OrderedItem[]): boolean {
  const topItem = orderedItems.find(({ entry }) => entry.role === "top")?.item;
  const bottomItem = orderedItems.find(({ entry }) => entry.role === "bottom")?.item;
  if (!topItem || !bottomItem) return true;
  return evaluateSilhouetteBalance(
    classifySilhouetteWeight(topItem.fit, topItem.silhouette),
    classifySilhouetteWeight(bottomItem.fit, bottomItem.silhouette),
  ).balanced;
}
