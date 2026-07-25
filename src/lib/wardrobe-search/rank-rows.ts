import type { ItemQuery } from "@/lib/ai/agents/orchestrator/intent";

import { scoreWardrobeMatch } from "./score-match";
import type { WardrobeSearchMatch, WardrobeSearchRow } from "./types";

const MAX_RETURNED_MATCHES = 24;

function toMatch(row: WardrobeSearchRow, score: number): WardrobeSearchMatch {
  return {
    itemId: row.id,
    name: row.name,
    brand: row.brand,
    category: row.category,
    subcategory: row.subcategory,
    colorNames: row.color_names,
    availability: row.availability_status,
    favorite: row.favorite,
    wearCount: row.wear_count,
    lastWornAt: row.last_worn_at,
    score,
  };
}

/** Deterministic ranking over rows the caller already scoped to one user. */
export function rankWardrobeRows(rows: readonly WardrobeSearchRow[], query: ItemQuery) {
  const eligible = rows.filter(
    (row) =>
      (!query.favoritesOnly || row.favorite) &&
      (!query.availableOnly || row.availability_status === "available"),
  );
  const scored = eligible
    .map((row) => toMatch(row, scoreWardrobeMatch(row, query)))
    .filter((match) => match.score > 0)
    .sort(
      (first, second) =>
        second.score - first.score ||
        second.wearCount - first.wearCount ||
        first.name.localeCompare(second.name),
    );

  return {
    matches: scored.slice(0, MAX_RETURNED_MATCHES),
    matchCount: scored.length,
    scannedCount: rows.length,
  };
}
