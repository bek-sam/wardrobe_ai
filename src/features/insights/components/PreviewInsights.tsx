import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { WardrobePreviewItem } from "@/features/wardrobe/components/wardrobe-item-card.types";

import { buildPreviewRediscoverEntries } from "./build-preview-rediscover-entries";
import { GapAnalysisCard } from "./GapAnalysisCard";
import { PreviewInsightGrid } from "./PreviewInsightGrid";
import { PreviewInsightsHeader } from "./PreviewInsightsHeader";
import { PREVIEW_STATS } from "./preview-insights-data.data";
import { RediscoverList } from "./RediscoverList";
import { StatsGrid } from "./StatsGrid";

export function PreviewInsights({ items }: { items: WardrobePreviewItem[] }) {
  return (
    <>
      <PreviewInsightsHeader />
      <StatsGrid ariaLabel="Sample wardrobe statistics" stats={PREVIEW_STATS} />
      <PreviewInsightGrid />
      <RediscoverList
        actionBadge={<Badge tone="outline">Sample items</Badge>}
        description="Sample low-wear pieces."
        items={buildPreviewRediscoverEntries(items)}
        title="Pieces to rediscover"
      />
      <GapAnalysisCard
        action={
          <Button disabled variant="secondary">
            See the reasoning
          </Button>
        }
        description="This is an illustrative preview, not a recommendation based on your data."
        heading="A rain-ready casual shoe may add useful range."
      />
    </>
  );
}
