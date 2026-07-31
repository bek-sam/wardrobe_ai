"use client";

import { useCallback, useState } from "react";

import type { SwapCandidate } from "../api/item-actions";
import { fetchOutfitVariants, type StudioRequestInput } from "../api/studio-client";
import { applySwap } from "./apply-swap";
import type { OutfitVariantMode, StudioVariantsResponse } from "../types";

export function useVariants() {
  const [result, setResult] = useState<StudioVariantsResponse | null>(null);
  const [mode, setMode] = useState<OutfitVariantMode>("safe");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(async (input: StudioRequestInput) => {
    setBusy(true);
    setError(null);
    try {
      const next = await fetchOutfitVariants(input);
      setResult(next);
      // Land on the first mode that actually came back, so an empty "safe"
      // slot never presents as "no looks found".
      setMode(next.variants[0]?.mode ?? "safe");
      return next;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The looks could not be generated.");
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  const swapItem = useCallback(
    (candidateId: string, fromItemId: string, replacement: SwapCandidate) => {
      setResult((previous) =>
        previous ? applySwap(previous, candidateId, fromItemId, replacement) : previous,
      );
    },
    [],
  );

  const variants = result?.variants ?? [];
  const selected = variants.find((variant) => variant.mode === mode) ?? variants[0] ?? null;

  return {
    result,
    variants,
    selected,
    mode: selected?.mode ?? mode,
    setMode,
    busy,
    error,
    request,
    swapItem,
  };
}
