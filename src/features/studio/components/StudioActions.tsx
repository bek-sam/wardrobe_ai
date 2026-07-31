"use client";

import type { StudioState } from "../hooks/studio-state.types";
import { OutfitActionDock } from "./OutfitActionDock";

export function StudioActions({
  studio,
  composerDate,
}: {
  studio: StudioState;
  composerDate: string;
}) {
  const variant = studio.variants.selected;
  if (!variant) return null;

  return (
    <OutfitActionDock
      busy={studio.actions.busy || studio.tryOn.busy}
      canVisualize={variant.canVisualize}
      hasLocks={studio.locks.locked.length > 0}
      mode={studio.stage}
      onPlan={() => void studio.actions.plan(composerDate)}
      onRemix={studio.remix}
      onSave={() => void studio.actions.save(variant)}
      onTryOn={studio.startTryOn}
      onWearToday={() => void studio.actions.wearToday()}
      saved={Boolean(studio.actions.savedOutfitId)}
    />
  );
}
