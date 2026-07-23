"use client";

import { PageHeader } from "@/components/ui/PageHeader";

import { handleManualOutfitSaved } from "./handle-manual-outfit-saved";
import { ManualOutfitDialog } from "./ManualOutfitDialog";
import { OutfitsFilterBar } from "./OutfitsFilterBar";
import { OutfitsHeaderActions } from "./OutfitsHeaderActions";
import { OutfitsNotices } from "./OutfitsNotices";
import { OutfitsResults } from "./OutfitsResults";
import type { OutfitPreview } from "./outfit-card.types";
import { PreviewOutfits } from "./PreviewOutfits";
import { useOutfitsManagerState } from "./use-outfits-manager-state";

export function OutfitsManager({
  configured,
  previewOutfits,
}: {
  configured: boolean;
  previewOutfits: OutfitPreview[];
}) {
  const state = useOutfitsManagerState(configured);

  if (!configured) return <PreviewOutfits outfits={previewOutfits} />;

  return (
    <>
      <PageHeader
        eyebrow="Saved combinations"
        title="Outfits"
        description="Keep the looks that work, revisit favorites, and learn from what you actually wear."
        actions={<OutfitsHeaderActions onBuildManually={() => state.setBuilderOpen(true)} />}
      />
      <OutfitsFilterBar state={state} />
      <OutfitsNotices
        error={state.error ?? state.actions.error}
        notice={state.actions.notice}
        onRetry={() => state.setRetry((value) => value + 1)}
      />
      <OutfitsResults state={state} />
      {state.builderOpen ? (
        <ManualOutfitDialog
          onClose={() => state.setBuilderOpen(false)}
          onSaved={(saved) => handleManualOutfitSaved(state, saved)}
        />
      ) : null}
    </>
  );
}
