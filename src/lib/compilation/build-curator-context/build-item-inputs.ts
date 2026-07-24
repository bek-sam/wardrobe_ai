import type { CuratorCandidateItemInput } from "@/lib/ai/agents/outfit-curator-agent";

import { flattenMaterials } from "./flatten-materials";
import type { OrderedItem } from "./order-items";

export function buildItemInputs(
  orderedItems: readonly OrderedItem[],
  createdItemIds: ReadonlySet<string>,
): CuratorCandidateItemInput[] {
  return orderedItems.map(({ entry, item }) => ({
    itemId: item.id,
    role: entry.role,
    category: item.category,
    subcategory: item.subcategory,
    colorNames: item.color_names,
    pattern: item.pattern,
    fit: item.fit,
    silhouette: item.silhouette,
    materials: flattenMaterials(item.materials),
    isNewItem: createdItemIds.has(item.id),
  }));
}
