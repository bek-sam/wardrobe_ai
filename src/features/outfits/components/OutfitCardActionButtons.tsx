import { CheckCircle, Heart, SpinnerGap, Trash } from "@phosphor-icons/react";

import { Button } from "@/components/ui/Button";

import type { OutfitRecord } from "./outfits-manager.types";

export function OutfitCardActionButtons({
  outfit,
  busy,
  onToggleFavorite,
  onMarkWorn,
  onDelete,
}: {
  outfit: OutfitRecord;
  busy: boolean;
  onToggleFavorite: () => void;
  onMarkWorn: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <Button
        aria-label={`${outfit.favorite ? "Remove" : "Add"} ${outfit.name} ${outfit.favorite ? "from" : "to"} favorites`}
        disabled={busy}
        onClick={onToggleFavorite}
        variant="ghost"
      >
        <Heart size={14} weight={outfit.favorite ? "fill" : "regular"} />
        {outfit.favorite ? "Favorited" : "Favorite"}
      </Button>
      <Button disabled={busy} onClick={onMarkWorn} variant="secondary">
        {busy ? <SpinnerGap className="spin" size={14} /> : <CheckCircle size={14} />}
        Mark worn
      </Button>
      <Button
        aria-label={`Delete ${outfit.name}`}
        disabled={busy}
        onClick={onDelete}
        variant="ghost"
      >
        <Trash size={14} />
      </Button>
    </>
  );
}
