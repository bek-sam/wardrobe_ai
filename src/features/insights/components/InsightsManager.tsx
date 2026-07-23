"use client";

import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import type { WardrobePreviewItem } from "@/features/wardrobe/components/wardrobe-item-card.types";

import { InsightsBody } from "./InsightsBody";
import { InsightsEmptyState } from "./InsightsEmptyState";
import { InsightsStatus } from "./InsightsStatus";
import { PreviewInsights } from "./PreviewInsights";
import { useInsights } from "./use-insights";

export function InsightsManager({
  configured,
  previewItems,
}: {
  configured: boolean;
  previewItems: WardrobePreviewItem[];
}) {
  const { insights, loading, error, setRetry, costSummary } = useInsights(configured);

  if (!configured) return <PreviewInsights items={previewItems} />;

  return (
    <>
      <PageHeader
        eyebrow="Wardrobe intelligence"
        title="Insights"
        description="See what earns its place, what gets overlooked, and where your wardrobe has room to improve."
        actions={
          <Button disabled title="Date-range filtering is coming soon" variant="secondary">
            All recorded history
          </Button>
        }
      />
      <InsightsStatus
        error={error}
        loading={loading}
        onRetry={() => setRetry((value) => value + 1)}
      />
      {!loading && insights?.itemCount === 0 ? <InsightsEmptyState /> : null}
      {!loading && insights && insights.itemCount > 0 ? (
        <InsightsBody costSummary={costSummary} insights={insights} />
      ) : null}
    </>
  );
}
