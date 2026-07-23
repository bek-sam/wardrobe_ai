import { titleCase } from "./insights-helpers";
import type { Insights } from "./insights.types";

export function buildCategoryBars(insights: Insights) {
  return insights.categories.map((category) => ({
    name: titleCase(category.name),
    percent: Math.round((category.count / insights.itemCount) * 100),
  }));
}
