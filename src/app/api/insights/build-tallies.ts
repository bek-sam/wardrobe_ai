import { resolveWardrobeItemRole } from "@/lib/recommendation/item-role";

import { increment } from "./counters";
import type { InsightItem } from "./types";

export function buildTallies(items: readonly InsightItem[]) {
  const categories = new Map<string, number>();
  const colors = new Map<string, number>();
  const seasons = new Map<string, number>();
  const roles = new Map<string, number>();

  for (const item of items) {
    increment(categories, item.category);
    for (const color of item.color_names) increment(colors, color.toLowerCase());
    for (const season of item.season_tags)
      increment(seasons, season.toLowerCase(), item.wear_count);
    const role = resolveWardrobeItemRole(item);
    if (role) increment(roles, role);
  }

  return { categories, colors, seasons, roles };
}
