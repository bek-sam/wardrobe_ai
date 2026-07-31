"use client";

import { useRef } from "react";
import { X } from "@phosphor-icons/react";

import type { StudioGarmentDetail } from "../types";
import { GarmentDetailActions } from "./GarmentDetailActions";
import { GarmentDetailBody } from "./GarmentDetailBody";
import { useFocusTrap } from "./use-focus-trap";

type Props = {
  garment: StudioGarmentDetail;
  locked: boolean;
  busy: boolean;
  onDismiss: () => void;
  onToggleLock: () => void;
  onSwap: () => void;
  onFavorite: () => void;
  onMarkWorn: () => void;
};

/**
 * One component for both breakpoints. CSS turns it into an anchored side panel
 * from 961px up and a full-width bottom sheet below, so there is a single
 * focus-trap and dialog implementation rather than two that can drift apart.
 */
export function GarmentDetailSheet({ garment, onDismiss, ...actions }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(containerRef, true, onDismiss);

  return (
    <div
      aria-label={`Details for ${(garment.item?.name as string) ?? "this piece"}`}
      aria-modal="true"
      className="garment-detail"
      ref={containerRef}
      role="dialog"
    >
      <button
        aria-label="Close garment details"
        className="garment-detail__close icon-button"
        onClick={onDismiss}
        type="button"
      >
        <X size={16} />
      </button>
      <GarmentDetailBody garment={garment} />
      <GarmentDetailActions garment={garment} {...actions} />
    </div>
  );
}
