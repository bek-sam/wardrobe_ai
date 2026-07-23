import { Badge } from "@/components/ui/Badge";

import { buildCategoryBars } from "./build-category-bars";
import { buildInsightsStats } from "./build-insights-stats";
import { buildRediscoverEntries } from "./build-rediscover-entries";
import { CategoryChart } from "./CategoryChart";
import { InsightsGapCard } from "./InsightsGapCard";
import { PaletteCard } from "./PaletteCard";
import { PaletteDescription } from "./PaletteDescription";
import { RediscoverList } from "./RediscoverList";
import { StatsGrid } from "./StatsGrid";
import type { Insights } from "./insights.types";

export function InsightsBody({
  insights,
  costSummary,
}: {
  insights: Insights;
  costSummary: string | null;
}) {
  return (
    <>
      <StatsGrid
        ariaLabel="Wardrobe statistics"
        stats={buildInsightsStats(insights, costSummary)}
      />
      <div className="insight-grid">
        <CategoryChart
          ariaLabel="Category distribution"
          bars={buildCategoryBars(insights)}
          caption={`Calculated from ${insights.itemCount} active wardrobe ${insights.itemCount === 1 ? "piece" : "pieces"}.`}
        />
        <PaletteCard
          ariaLabel="Wardrobe color palette"
          colors={insights.colors.slice(0, 5).map((color) => color.name)}
          description={<PaletteDescription insights={insights} />}
        />
      </div>
      <RediscoverList
        actionBadge={<Badge tone="outline">Wear history</Badge>}
        description="A gentle nudge toward your lowest-wear pieces."
        items={buildRediscoverEntries(insights.leastWorn.slice(0, 3))}
        title="Pieces to rediscover"
      />
      <InsightsGapCard insights={insights} />
    </>
  );
}
