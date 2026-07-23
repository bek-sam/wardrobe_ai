import { isObject } from "@/lib/api/normalize";
import { requestJson } from "@/lib/api/request";
import { resolveWardrobeItemRole } from "@/lib/recommendation/item-role";

import { normalizeOwnedItem } from "./normalize-owned-item";
import type { OutfitSelection, OwnedItem } from "./stylist.types";
import type { useStylistSession } from "./use-stylist-session";

export function useOpenSwap(session: ReturnType<typeof useStylistSession>) {
  return async function openSwap(selection: OutfitSelection) {
    if (!session.savedOutfitId || !session.recommendation) return;
    session.setSwapBusy(true);
    session.setError(null);
    try {
      const result = await requestJson<unknown>(
        "/api/items?status=active&availability=available&limit=100",
      );
      const rawItems = isObject(result) && Array.isArray(result.items) ? result.items : [];
      const selectedIds = new Set(session.recommendation.items.map((item) => item.item_id));
      const candidates = rawItems
        .map((item) => normalizeOwnedItem(item))
        .filter((item): item is OwnedItem => Boolean(item))
        .filter((item) => {
          if (selectedIds.has(item.id)) return false;
          const role = resolveWardrobeItemRole({
            layer_role: item.layerRole,
            category: item.category,
            subcategory: item.subcategory,
          });
          return role === selection.role;
        });
      session.setSwap({
        removeItemId: selection.item_id,
        role: selection.role,
        candidates,
        replacementId: candidates[0]?.id ?? "",
      });
    } catch (caught) {
      session.setError(
        caught instanceof Error ? caught.message : "Replacement items could not be loaded.",
      );
    } finally {
      session.setSwapBusy(false);
    }
  };
}
