"use client";

import Link from "next/link";
import { ArrowsClockwise, Heart, Lock, LockOpen } from "@phosphor-icons/react";

import { Button } from "@/components/ui/Button";

import type { StudioGarmentDetail } from "../types";

type Props = {
  garment: StudioGarmentDetail;
  locked: boolean;
  busy: boolean;
  onToggleLock: () => void;
  onSwap: () => void;
  onFavorite: () => void;
  onMarkWorn: () => void;
};

export function GarmentDetailActions({
  garment,
  locked,
  busy,
  onToggleLock,
  onSwap,
  onFavorite,
  onMarkWorn,
}: Props) {
  const favorite = garment.item?.favorite === true;

  return (
    <div className="garment-detail__actions">
      <Link className="button button--secondary button--small" href={`/wardrobe/${garment.itemId}`}>
        View clothing
      </Link>
      <Button disabled={busy} onClick={onSwap} variant="ghost" className="button--small">
        <ArrowsClockwise size={14} /> Swap
      </Button>
      <Button onClick={onToggleLock} variant="ghost" className="button--small">
        {locked ? <Lock size={14} weight="fill" /> : <LockOpen size={14} />}
        {locked ? "Unlock" : "Lock"}
      </Button>
      <Button disabled={busy} onClick={onFavorite} variant="ghost" className="button--small">
        <Heart size={14} weight={favorite ? "fill" : "regular"} />
        {favorite ? "Unfavorite" : "Favorite"}
      </Button>
      <Button disabled={busy} onClick={onMarkWorn} variant="ghost" className="button--small">
        Mark worn
      </Button>
    </div>
  );
}
