"use client";

import type { SwapCandidate } from "../api/item-actions";
import type { useLocks } from "./use-locks";
import type { useTryOn } from "./use-tryon";
import type { useVariants } from "./use-variants";

type Deps = {
  variants: ReturnType<typeof useVariants>;
  locks: ReturnType<typeof useLocks>;
  tryOn: ReturnType<typeof useTryOn>;
  onSwapped: (replacementId: string) => void;
};

/**
 * Swapping a piece updates the flat lay immediately and retires the previous
 * try-on: an image of the old combination must never be presented as the new
 * one. The lock on the removed item goes with it, since a lock names an exact
 * item id and that item is no longer in the look.
 */
export function useStudioSwap({ variants, locks, tryOn, onSwapped }: Deps) {
  return (fromItemId: string, replacement: SwapCandidate) => {
    const candidateId = variants.selected?.candidateId;
    if (candidateId) variants.swapItem(candidateId, fromItemId, replacement);
    locks.unlockItem(fromItemId);
    tryOn.reset();
    onSwapped(replacement.id);
  };
}
