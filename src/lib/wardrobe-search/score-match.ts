import type { ItemQuery } from "@/lib/ai/agents/orchestrator/intent";

import type { WardrobeSearchRow } from "./types";

function joined(values: readonly (string | null)[]) {
  return values
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();
}

export function colorText(row: WardrobeSearchRow) {
  return joined([...row.color_names, row.name, row.pattern]);
}

export function categoryText(row: WardrobeSearchRow) {
  return joined([row.category, row.subcategory, row.layer_role, row.name]);
}

export function searchText(row: WardrobeSearchRow) {
  return joined([
    row.name,
    row.brand,
    row.product_name,
    row.category,
    row.subcategory,
    row.layer_role,
    row.pattern,
    row.fit,
    ...row.color_names,
    ...row.season_tags,
    ...row.occasion_tags,
  ]);
}

/**
 * Colour and garment words are required matches -- "blue blazer" must not
 * return a red blazer -- while remaining terms only add rank. Returns 0 when
 * the row is not a match at all.
 */
export function scoreWardrobeMatch(row: WardrobeSearchRow, query: ItemQuery) {
  const colors = colorText(row);
  const categories = categoryText(row);
  if (!query.colors.every((color) => colors.includes(color))) return 0;
  if (query.categories.length > 0 && !query.categories.some((word) => categories.includes(word))) {
    return 0;
  }

  const haystack = searchText(row);
  const matched = query.terms.filter((term) => haystack.includes(term));
  if (matched.length === 0) return 0;
  return (
    matched.length * 2 + query.colors.length + query.categories.length + (row.favorite ? 1 : 0)
  );
}
