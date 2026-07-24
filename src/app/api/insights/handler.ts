import type { SupabaseClient } from "@supabase/supabase-js";

import { buildCostPerWear } from "./build-cost-per-wear";
import { buildFoundationGaps } from "./build-foundation-gaps";
import { buildOverrepresented } from "./build-overrepresented";
import { buildTallies } from "./build-tallies";
import { sortedCounts } from "./counters";
import { fetchInsightItems } from "./fetch-items";

export async function handleGetInsights(supabase: SupabaseClient, userId: string) {
  const items = await fetchInsightItems(supabase, userId);
  const { categories, colors, seasons, roles } = buildTallies(items);

  const byWear = [...items].sort(
    (first, second) =>
      second.wear_count - first.wear_count || first.name.localeCompare(second.name),
  );

  return {
    itemCount: items.length,
    categories: sortedCounts(categories),
    colors: sortedCounts(colors),
    seasonalWear: sortedCounts(seasons),
    mostWorn: byWear.slice(0, 8),
    leastWorn: [...byWear].reverse().slice(0, 8),
    neverWorn: items.filter((item) => item.wear_count === 0),
    costPerWear: buildCostPerWear(items),
    possibleFoundations:
      (roles.get("top") ?? 0) * (roles.get("bottom") ?? 0) + (roles.get("dress") ?? 0),
    gapSuggestions: buildFoundationGaps(roles),
    overrepresented: buildOverrepresented(categories, items.length),
  };
}
