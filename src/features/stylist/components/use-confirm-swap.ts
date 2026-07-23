import { requestJson } from "@/lib/api/request";

import type { useStylistSession } from "./use-stylist-session";

export function useConfirmSwap(session: ReturnType<typeof useStylistSession>) {
  return async function confirmSwap() {
    const swap = session.swap;
    if (!swap || !swap.replacementId || !session.savedOutfitId || !session.recommendation) return;
    session.setSwapBusy(true);
    session.setError(null);
    try {
      await requestJson<unknown>(`/api/outfits/${encodeURIComponent(session.savedOutfitId)}/swap`, {
        method: "POST",
        body: JSON.stringify({
          remove_item_id: swap.removeItemId,
          replacement_item_id: swap.replacementId,
        }),
      });
      const replacement = swap.candidates.find((item) => item.id === swap.replacementId);
      const details = new Map(session.recommendation.itemDetails);
      details.delete(swap.removeItemId);
      if (replacement) details.set(replacement.id, replacement);
      session.setRecommendation({
        ...session.recommendation,
        itemDetails: details,
        items: session.recommendation.items.map((item) =>
          item.item_id === swap.removeItemId ? { ...item, item_id: swap.replacementId } : item,
        ),
      });
      session.setSwap(null);
      session.setFeedback(null);
    } catch (caught) {
      session.setError(
        caught instanceof Error ? caught.message : "The outfit item could not be swapped.",
      );
    } finally {
      session.setSwapBusy(false);
    }
  };
}
