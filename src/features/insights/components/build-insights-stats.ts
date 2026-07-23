import { CoatHanger, CurrencyDollar, Recycle, TrendUp } from "@phosphor-icons/react";

import type { StatCard } from "./StatsGrid";
import type { Insights } from "./insights.types";

export function buildInsightsStats(insights: Insights, costSummary: string | null): StatCard[] {
  return [
    {
      icon: CoatHanger,
      label: "Active pieces",
      value: insights.itemCount.toString(),
      note: `${insights.categories.length} ${insights.categories.length === 1 ? "category" : "categories"}`,
    },
    {
      icon: TrendUp,
      label: "Outfit foundations",
      value: insights.possibleFoundations.toString(),
      note: "Top and bottom combinations",
    },
    {
      icon: CurrencyDollar,
      label: "Avg. cost / wear",
      value: costSummary ?? "—",
      note: costSummary
        ? `${insights.costPerWear.length} priced pieces with wears`
        : "Add price and wear data",
    },
    {
      icon: Recycle,
      label: "Never worn",
      value: insights.neverWorn.length.toString(),
      note: "Based on recorded wear history",
    },
  ];
}
