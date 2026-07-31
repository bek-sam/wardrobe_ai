import { requestJson } from "@/lib/api/request";

import type { StudioVariantItem } from "../types";

/** Saves the exact selection through the canonical create_user_outfit RPC. */
export function saveStudioOutfit(
  name: string,
  occasion: string | null,
  items: readonly StudioVariantItem[],
) {
  return requestJson<{ id?: string } | string>("/api/outfits", {
    method: "POST",
    body: JSON.stringify({
      name,
      occasion,
      items: items.map((item, index) => ({
        item_id: item.itemId,
        role: item.role,
        sort_order: index,
      })),
    }),
  });
}

export function markOutfitWorn(outfitId: string) {
  return requestJson<unknown>(`/api/outfits/${outfitId}/wear`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function planOutfit(outfitId: string, plannedDate: string, occasion: string | null) {
  return requestJson<unknown>("/api/plans", {
    method: "POST",
    body: JSON.stringify({ outfit_id: outfitId, planned_date: plannedDate, occasion }),
  });
}
