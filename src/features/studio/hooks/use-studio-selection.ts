"use client";

import { useState } from "react";

import type { OutfitItemRole } from "@/features/outfits/types";

import type { StudioMode } from "./studio-mode";

/** Which stage is showing, which garment is selected, and any open swap. */
export function useStudioSelection() {
  const [stage, setStage] = useState<StudioMode>("flat-lay");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [swapping, setSwapping] = useState<{ role: OutfitItemRole; itemId: string } | null>(null);

  return {
    stage,
    setStage,
    selectedItemId,
    setSelectedItemId,
    swapping,
    setSwapping,
  };
}
