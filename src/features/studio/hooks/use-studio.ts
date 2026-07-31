"use client";

import type { StudioRequestInput } from "../api/studio-client";
import { snapshotSelection } from "./snapshot-selection";
import { useStudioRequest } from "./use-studio-request";
import { useStudioSelection } from "./use-studio-selection";
import { useStudioSwap } from "./use-studio-swap";
import { useLocks } from "./use-locks";
import { useOutfitActions } from "./use-outfit-actions";
import { useTryOn } from "./use-tryon";
import { useVariants } from "./use-variants";

/**
 * One place that owns the studio's cross-cutting state, so switching between
 * Flat Lay and AI Try-On never discards the selection, the locks, or an
 * in-flight generation.
 */
export function useStudio(
  occasion: string | null,
  buildInput: (surprise?: boolean) => StudioRequestInput,
) {
  const [variants, locks, tryOn] = [useVariants(), useLocks(), useTryOn()];
  const actions = useOutfitActions(occasion);
  const selection = useStudioSelection();
  const { setStage, setSelectedItemId, setSwapping } = selection;
  const shared = { variants, locks, tryOn };

  const request = useStudioRequest({
    ...shared,
    onReset: () => {
      setSelectedItemId(null);
      setStage("flat-lay");
    },
  });

  const swapItem = useStudioSwap({
    ...shared,
    onSwapped: (replacementId) => {
      setSelectedItemId(replacementId);
      setSwapping(null);
    },
  });

  const startTryOn = () => {
    if (!variants.selected) return;
    setStage("try-on");
    void tryOn.start(snapshotSelection(variants.selected.items));
  };

  return {
    ...selection,
    remix: () => void request(buildInput()),
    swapItem,
    variants,
    locks,
    tryOn,
    actions,
    request,
    startTryOn,
  };
}
