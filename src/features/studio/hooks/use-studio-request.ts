"use client";

import type { StudioRequestInput } from "../api/studio-client";
import type { useLocks } from "./use-locks";
import type { useTryOn } from "./use-tryon";
import type { useVariants } from "./use-variants";

type Deps = {
  variants: ReturnType<typeof useVariants>;
  locks: ReturnType<typeof useLocks>;
  tryOn: ReturnType<typeof useTryOn>;
  onReset: () => void;
};

/**
 * Requests a fresh set of looks. Locks travel with every request, so a plain
 * re-run behaves as a remix of the unlocked roles rather than silently
 * discarding them. A new set of looks always retires the previous try-on and
 * any selection pinned to a garment that may no longer be in the outfit.
 */
export function useStudioRequest({ variants, locks, tryOn, onReset }: Deps) {
  return async (input: StudioRequestInput) => {
    const next = await variants.request({
      ...input,
      lockedItemIds: locks.locked.map((piece) => piece.itemId),
    });
    tryOn.reset();
    onReset();
    return next;
  };
}
