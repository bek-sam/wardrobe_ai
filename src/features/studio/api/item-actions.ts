import { requestJson } from "@/lib/api/request";
import type { WardrobeItemRole } from "@/features/wardrobe/types";

export type SwapCandidate = {
  id: string;
  name: string;
  layer_role: WardrobeItemRole | null;
  category: string;
  subcategory: string | null;
};

export function setItemFavorite(itemId: string, favorite: boolean) {
  return requestJson<unknown>(`/api/items/${itemId}/favorite`, {
    method: "POST",
    body: JSON.stringify({ favorite }),
  });
}

export function markItemWorn(itemId: string) {
  return requestJson<unknown>(`/api/items/${itemId}/mark-worn`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

/**
 * Available owned items. The list route filters availability and status
 * server-side; role is resolved client-side with the same shared helper the
 * server uses, and every mutation re-checks it before writing anything.
 */
export function fetchAvailableItems() {
  const query = new URLSearchParams({
    availability: "available",
    status: "active",
    limit: "100",
  });
  return requestJson<{ items: SwapCandidate[] }>(`/api/items?${query.toString()}`);
}
