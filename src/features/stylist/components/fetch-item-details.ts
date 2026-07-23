import { requestJson } from "@/lib/api/request";

import { normalizeOwnedItem } from "./normalize-owned-item";
import type { OutfitSelection, OwnedItem } from "./stylist.types";

export async function fetchItemDetails(
  items: OutfitSelection[],
  signal: AbortSignal,
): Promise<Map<string, OwnedItem>> {
  const settled = await Promise.allSettled(
    items.map((item) =>
      requestJson<unknown>(`/api/items/${encodeURIComponent(item.item_id)}`, { signal }),
    ),
  );
  if (signal.aborted) throw new DOMException("The request was aborted.", "AbortError");
  const details = new Map<string, OwnedItem>();
  settled.forEach((entry, index) => {
    if (entry.status === "fulfilled") {
      const normalized = normalizeOwnedItem(entry.value, items[index]!.item_id);
      if (normalized) details.set(items[index]!.item_id, normalized);
    }
  });
  return details;
}
