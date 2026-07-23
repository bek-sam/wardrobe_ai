import { normalizeItem } from "./normalize-today-item";
import { requestJson } from "./today-request";
import type { OutfitSelection, TodayItem } from "./today.types";

export async function fetchSelectedDetails(
  selections: OutfitSelection[],
  signal: AbortSignal,
): Promise<Record<string, TodayItem>> {
  const detailPairs = await Promise.all(
    selections.map(async (selection) => {
      const raw = await requestJson<unknown>(
        `/api/items/${encodeURIComponent(selection.item_id)}`,
        { signal },
      );
      const item = normalizeItem(raw, selection.item_id);
      if (!item) throw new Error(`Owned item ${selection.item_id} could not be verified.`);
      return [selection.item_id, item] as const;
    }),
  );
  return Object.fromEntries(detailPairs);
}
