"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import type { OutfitItemRole } from "@/features/outfits/types";
import { resolveWardrobeItemRole } from "@/lib/recommendation";

import { fetchAvailableItems, type SwapCandidate } from "../api/item-actions";

type Props = {
  role: OutfitItemRole;
  currentItemId: string;
  onSwap: (replacement: SwapCandidate) => void;
  onDismiss: () => void;
};

/**
 * Only role-compatible, active, available owned items appear. Anything that
 * would break the foundation rule is filtered out here and rejected again by
 * the server, so a swap can never leave the outfit in an invalid state.
 */
export function OutfitSwapPicker({ role, currentItemId, onSwap, onDismiss }: Props) {
  const [candidates, setCandidates] = useState<SwapCandidate[] | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const { items } = await fetchAvailableItems();
        setCandidates(
          items.filter(
            (item) => item.id !== currentItemId && resolveWardrobeItemRole(item) === role,
          ),
        );
      } catch {
        setCandidates([]);
      }
    })();
  }, [role, currentItemId]);

  return (
    <div className="swap-picker" role="dialog" aria-label={`Swap this ${role}`}>
      <p className="swap-picker__title">Swap this {role}</p>
      {candidates === null ? <p>Loading your options…</p> : null}
      {candidates?.length === 0 ? <p>No other available {role} fits here right now.</p> : null}
      <ul className="swap-picker__list">
        {(candidates ?? []).map((candidate) => (
          <li key={candidate.id}>
            <button onClick={() => onSwap(candidate)} type="button">
              {candidate.name}
            </button>
          </li>
        ))}
      </ul>
      <Button className="button--small" onClick={onDismiss} variant="ghost">
        Cancel
      </Button>
    </div>
  );
}
