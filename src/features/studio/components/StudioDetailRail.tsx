"use client";

import { markItemWorn, setItemFavorite } from "../api/item-actions";
import type { StudioState } from "../hooks/studio-state.types";
import { GarmentDetailSheet } from "./GarmentDetailSheet";
import { OutfitSwapPicker } from "./OutfitSwapPicker";
import { OutfitWhyPanel } from "./OutfitWhyPanel";
import { flatLayGarments } from "./flat-lay-garments";

/**
 * The why-panel is always present — it is the answer to "why this look" and
 * should not vanish when a garment is inspected. The detail sheet renders
 * *in addition*: an anchored panel on desktop, a fixed bottom sheet on mobile.
 * Rendering it once rather than duplicating it per breakpoint keeps a single
 * heading in the accessibility tree.
 */
export function StudioDetailRail({ studio }: { studio: StudioState }) {
  const variant = studio.variants.selected;
  if (!variant) return null;

  const garments = studio.tryOn.visualization?.garments ?? flatLayGarments(variant.items);
  const selected = garments.find((garment) => garment.itemId === studio.selectedItemId) ?? null;

  return (
    <>
      <OutfitWhyPanel variant={variant} />

      {studio.swapping ? (
        <OutfitSwapPicker
          currentItemId={studio.swapping.itemId}
          onDismiss={() => studio.setSwapping(null)}
          onSwap={(replacement) => studio.swapItem(studio.swapping!.itemId, replacement)}
          role={studio.swapping.role}
        />
      ) : null}

      {selected && !studio.swapping ? (
        <GarmentDetailSheet
          busy={studio.actions.busy}
          garment={selected}
          locked={studio.locks.isLocked(selected.itemId)}
          onDismiss={() => studio.setSelectedItemId(null)}
          onFavorite={() =>
            void setItemFavorite(selected.itemId, selected.item?.favorite !== true).catch(
              () => null,
            )
          }
          onMarkWorn={() => void markItemWorn(selected.itemId).catch(() => null)}
          onSwap={() => studio.setSwapping({ role: selected.role, itemId: selected.itemId })}
          onToggleLock={() => studio.locks.toggleLock(selected.role, selected.itemId)}
        />
      ) : null}
    </>
  );
}
