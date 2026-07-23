"use client";

import { PageHeader } from "@/components/ui/PageHeader";

import { PreviewWardrobe } from "./PreviewWardrobe";
import { useWardrobeManagerState } from "./use-wardrobe-manager-state";
import { WardrobeHeaderActions } from "./WardrobeHeaderActions";
import type { WardrobePreviewItem } from "./wardrobe-item-card.types";
import { WardrobeManagerFilters } from "./WardrobeManagerFilters";
import { WardrobeManagerFormDialog } from "./WardrobeManagerFormDialog";
import { WardrobeManagerResults } from "./WardrobeManagerResults";

export function WardrobeManager({
  configured,
  previewItems,
}: {
  configured: boolean;
  previewItems: WardrobePreviewItem[];
}) {
  const state = useWardrobeManagerState(configured);

  if (!configured) return <PreviewWardrobe items={previewItems} />;

  return (
    <>
      <PageHeader
        eyebrow="Your closet"
        title="Wardrobe"
        description="Search, filter, and understand every piece you own."
        actions={<WardrobeHeaderActions onAddManually={() => state.openForm(null)} />}
      />
      <WardrobeManagerFilters
        clearAdvancedFilters={state.clearAdvancedFilters}
        clearAllFilters={state.clearAllFilters}
        filters={state.filters}
        filtersOpen={state.filtersOpen}
        setFilter={state.setFilter}
        setFiltersOpen={state.setFiltersOpen}
        setViewMode={state.setViewMode}
        total={state.total}
        viewMode={state.viewMode}
      />
      <WardrobeManagerResults state={state} />
      <WardrobeManagerFormDialog state={state} />
    </>
  );
}
