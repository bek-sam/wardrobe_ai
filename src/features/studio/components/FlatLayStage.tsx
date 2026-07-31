"use client";

import { useCutouts } from "../hooks/use-cutouts";
import type { StudioVariant } from "../types";
import { FlatLayPiece } from "./FlatLayPiece";

type Props = {
  variant: StudioVariant;
  selectedItemId: string | null;
  isLocked: (itemId: string) => boolean;
  onSelect: (itemId: string) => void;
  onToggleLock: (role: StudioVariant["items"][number]["role"], itemId: string) => void;
};

/**
 * The immediate view: real garment cut-outs composed deterministically. It
 * makes no image-generation call and needs no consent, so a look is inspectable
 * the moment it is recommended.
 */
export function FlatLayStage({ variant, selectedItemId, isLocked, onSelect, onToggleLock }: Props) {
  const cutouts = useCutouts(variant.items.map((item) => item.itemId));

  return (
    <div className="flat-lay" data-testid="flat-lay">
      <div className="flat-lay__grid">
        {variant.items.map((item) => (
          <FlatLayPiece
            key={item.itemId}
            item={item}
            cutoutUrl={cutouts[item.itemId]}
            locked={isLocked(item.itemId)}
            selected={selectedItemId === item.itemId}
            onSelect={() => onSelect(item.itemId)}
            onToggleLock={() => onToggleLock(item.role, item.itemId)}
          />
        ))}
      </div>
    </div>
  );
}
