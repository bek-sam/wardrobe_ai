import type { SupabaseClient } from "@supabase/supabase-js";

import type { AvailabilityStatus, WardrobeItemRole } from "@/features/wardrobe";
import type { ItemQuery } from "@/lib/ai/agents/orchestrator/intent";

export type WardrobeSearchRow = {
  id: string;
  name: string;
  brand: string | null;
  product_name: string | null;
  category: string;
  subcategory: string | null;
  layer_role: WardrobeItemRole | null;
  color_names: string[];
  pattern: string | null;
  fit: string | null;
  season_tags: string[];
  occasion_tags: string[];
  availability_status: AvailabilityStatus;
  favorite: boolean;
  wear_count: number;
  last_worn_at: string | null;
};

export type WardrobeSearchMatch = {
  itemId: string;
  name: string;
  brand: string | null;
  category: string;
  subcategory: string | null;
  colorNames: string[];
  availability: AvailabilityStatus;
  favorite: boolean;
  wearCount: number;
  lastWornAt: string | null;
  score: number;
};

export type WardrobeSearchResult = {
  matches: WardrobeSearchMatch[];
  matchCount: number;
  scannedCount: number;
};

export const WARDROBE_SEARCH_COLUMNS =
  "id,name,brand,product_name,category,subcategory,layer_role,color_names,pattern,fit,season_tags,occasion_tags,availability_status,favorite,wear_count,last_worn_at";

function joined(values: readonly (string | null)[]) {
  return values
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();
}

export function scoreWardrobeMatch(row: WardrobeSearchRow, query: ItemQuery) {
  const colors = joined([...row.color_names, row.name, row.pattern]);
  const categories = joined([row.category, row.subcategory, row.layer_role, row.name]);
  if (!query.colors.every((color) => colors.includes(color))) return 0;
  if (query.categories.length > 0 && !query.categories.some((word) => categories.includes(word))) {
    return 0;
  }
  const haystack = joined([
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
  const matched = query.terms.filter((term) => haystack.includes(term));
  return matched.length === 0
    ? 0
    : matched.length * 2 + query.colors.length + query.categories.length + (row.favorite ? 1 : 0);
}

export function rankWardrobeRows(rows: readonly WardrobeSearchRow[], query: ItemQuery) {
  const scored = rows
    .filter(
      (row) =>
        (!query.favoritesOnly || row.favorite) &&
        (!query.availableOnly || row.availability_status === "available"),
    )
    .map((row) => ({
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
      score: scoreWardrobeMatch(row, query),
    }))
    .filter((match) => match.score > 0)
    .sort(
      (first, second) =>
        second.score - first.score ||
        second.wearCount - first.wearCount ||
        first.name.localeCompare(second.name),
    );
  return { matches: scored.slice(0, 24), matchCount: scored.length, scannedCount: rows.length };
}

export async function searchWardrobeItems(
  supabase: SupabaseClient,
  userId: string,
  query: ItemQuery,
): Promise<WardrobeSearchResult> {
  if (query.terms.length === 0) return { matches: [], matchCount: 0, scannedCount: 0 };
  const rows: WardrobeSearchRow[] = [];
  for (let offset = 0; ; offset += 500) {
    let pageQuery = supabase
      .from("wardrobe_items")
      .select(WARDROBE_SEARCH_COLUMNS)
      .eq("user_id", userId)
      .eq("status", "active")
      .is("deleted_at", null);
    if (query.favoritesOnly) pageQuery = pageQuery.eq("favorite", true);
    if (query.availableOnly) pageQuery = pageQuery.eq("availability_status", "available");
    const { data, error } = await pageQuery
      .order("id", { ascending: true })
      .range(offset, offset + 499);
    if (error) throw error;
    const page = (data ?? []) as unknown as WardrobeSearchRow[];
    rows.push(...page);
    if (page.length < 500) break;
  }
  return rankWardrobeRows(rows, query);
}
