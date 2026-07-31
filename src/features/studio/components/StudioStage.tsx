"use client";

import type { StudioState } from "../hooks/studio-state.types";
import { FlatLayStage } from "./FlatLayStage";
import { GarmentSelectorChips } from "./GarmentSelectorChips";
import { StageModeTabs } from "./StageModeTabs";
import { TryOnStage } from "./TryOnStage";
import { flatLayGarments } from "./flat-lay-garments";

/** The centre column: mode tabs, the active stage, and the garment chips. */
export function StudioStage({ studio }: { studio: StudioState }) {
  const variant = studio.variants.selected;
  if (!variant) return null;

  const tryOnGarments = studio.tryOn.visualization?.garments ?? [];
  const chips =
    studio.stage === "try-on" && tryOnGarments.length > 0
      ? tryOnGarments
      : flatLayGarments(variant.items);

  return (
    <div className="studio-stage" id="studio-stage" role="tabpanel">
      <StageModeTabs mode={studio.stage} onSelect={studio.setStage} />

      {studio.stage === "flat-lay" ? (
        <FlatLayStage
          isLocked={studio.locks.isLocked}
          onSelect={studio.setSelectedItemId}
          onToggleLock={studio.locks.toggleLock}
          selectedItemId={studio.selectedItemId}
          variant={variant}
        />
      ) : (
        <TryOnStage
          busy={studio.tryOn.busy}
          needsSetup={studio.tryOn.needsSetup}
          notice={studio.tryOn.notice}
          onBackToFlatLay={() => studio.setStage("flat-lay")}
          onRetry={() => void studio.tryOn.retry()}
          onSelect={studio.setSelectedItemId}
          onStart={studio.startTryOn}
          selectedItemId={studio.selectedItemId}
          variant={variant}
          visualization={studio.tryOn.visualization}
        />
      )}

      <GarmentSelectorChips
        garments={chips}
        onSelect={studio.setSelectedItemId}
        selectedItemId={studio.selectedItemId}
      />
    </div>
  );
}
