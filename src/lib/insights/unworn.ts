import type { InsightItem } from "./types";

const DAY_MS = 86_400_000;

export type UnwornItem = {
  item: InsightItem;
  lastWornDate: string | null;
  daysSince: number | null;
};

/**
 * Items with no wear at all when `since` is null, otherwise items whose last
 * recorded wear is older than that ISO date. Wear counts without a timestamp
 * are treated as "no recorded wear" rather than silently assumed recent.
 */
export function buildUnwornItems(
  items: readonly InsightItem[],
  since: string | null,
  referenceDate: string,
): UnwornItem[] {
  const referenceTime = Date.parse(`${referenceDate}T00:00:00.000Z`);
  return items
    .map((item) => {
      const lastWornDate =
        item.wear_count > 0 && item.last_worn_at ? item.last_worn_at.slice(0, 10) : null;
      const daysSince = lastWornDate
        ? Math.max(
            0,
            Math.floor((referenceTime - Date.parse(`${lastWornDate}T00:00:00.000Z`)) / DAY_MS),
          )
        : null;
      return { item, lastWornDate, daysSince };
    })
    .filter((entry) =>
      entry.lastWornDate === null ? true : Boolean(since && entry.lastWornDate < since),
    )
    .sort(
      (first, second) =>
        (second.daysSince ?? Number.MAX_SAFE_INTEGER) -
          (first.daysSince ?? Number.MAX_SAFE_INTEGER) ||
        first.item.name.localeCompare(second.item.name),
    );
}
