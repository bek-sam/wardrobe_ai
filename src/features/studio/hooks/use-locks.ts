"use client";

import { useCallback, useState } from "react";

import type { OutfitItemRole } from "@/features/outfits/types";

export type LockedPiece = { role: OutfitItemRole; itemId: string };

/**
 * Locks are keyed by role and hold an exact item ID. Remix keeps those IDs
 * untouched and only re-picks the unlocked roles — the invariant the whole
 * feature rests on is that a locked piece never changes.
 */
export function useLocks() {
  const [locked, setLocked] = useState<LockedPiece[]>([]);

  const isLocked = useCallback(
    (itemId: string) => locked.some((piece) => piece.itemId === itemId),
    [locked],
  );

  const toggleLock = useCallback((role: OutfitItemRole, itemId: string) => {
    setLocked((previous) => {
      const existing = previous.find((piece) => piece.itemId === itemId);
      if (existing) return previous.filter((piece) => piece.itemId !== itemId);
      // One lock per role: locking a second top would make the constraint
      // unsatisfiable rather than more specific.
      return [...previous.filter((piece) => piece.role !== role), { role, itemId }];
    });
  }, []);

  /** A swapped-out piece cannot stay locked — the lock referenced its exact id. */
  const unlockItem = useCallback((itemId: string) => {
    setLocked((previous) => previous.filter((piece) => piece.itemId !== itemId));
  }, []);

  return { locked, isLocked, toggleLock, unlockItem };
}
