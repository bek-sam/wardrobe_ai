import type { UnwornItem, WardrobeInsights } from "@/lib/insights";

import type { InsightHighlight } from "../answers.types";
import type { InsightFocus } from "../intent";

const MAX_HIGHLIGHTS = 8;

function unwornHighlights(unworn: readonly UnwornItem[]): InsightHighlight[] {
  return unworn.slice(0, MAX_HIGHLIGHTS).map((entry) => ({
    label: entry.item.name,
    detail: entry.lastWornDate
      ? `last worn ${entry.lastWornDate} (${entry.daysSince} days ago)`
      : "never worn",
    itemId: entry.item.id,
  }));
}

/** Every highlight is computed from the user's own rows -- no model call. */
export function buildInsightHighlights(
  focus: InsightFocus,
  insights: WardrobeInsights,
  unworn: readonly UnwornItem[],
): InsightHighlight[] {
  if (focus === "unworn") return unwornHighlights(unworn);
  if (focus === "least_worn" || focus === "most_worn") {
    const items = focus === "most_worn" ? insights.mostWorn : insights.leastWorn;
    return items.slice(0, MAX_HIGHLIGHTS).map((item) => ({
      label: item.name,
      detail: `${item.wear_count} ${item.wear_count === 1 ? "wear" : "wears"}`,
      itemId: item.id,
    }));
  }
  if (focus === "cost_per_wear") {
    return insights.costPerWear.slice(0, MAX_HIGHLIGHTS).map((entry) => ({
      label: entry.name,
      detail: `${entry.value.toFixed(2)}${entry.currency ? ` ${entry.currency}` : ""} per wear`,
      itemId: entry.itemId,
    }));
  }
  if (focus === "gaps") {
    return [...insights.gapSuggestions, ...insights.overrepresented]
      .slice(0, MAX_HIGHLIGHTS)
      .map((entry) => ({
        label: "role" in entry ? `Missing: ${entry.role}` : `Heavy on: ${entry.name}`,
        detail: entry.note,
        itemId: null,
      }));
  }
  return insights.categories.slice(0, MAX_HIGHLIGHTS).map((category) => ({
    label: category.name,
    detail: `${category.count} ${category.count === 1 ? "item" : "items"}`,
    itemId: null,
  }));
}
