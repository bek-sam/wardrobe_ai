"use client";

import { useCallback, useState } from "react";

import { markOutfitWorn, planOutfit, saveStudioOutfit } from "../api/outfit-actions";
import type { StudioVariant } from "../types";
import { savedOutfitIdOf } from "./saved-outfit-id";

/**
 * Save, wear, and plan all go through the canonical RPC-backed routes rather
 * than writing tables directly, so quota, ownership, and idempotency stay
 * where they already live.
 */
export function useOutfitActions(occasion: string | null) {
  const [savedOutfitId, setSavedOutfitId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const run = useCallback(async (action: () => Promise<string | null>) => {
    setBusy(true);
    try {
      setMessage(await action());
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "That did not work.");
    } finally {
      setBusy(false);
    }
  }, []);

  const save = (variant: StudioVariant) =>
    run(async () => {
      const id = savedOutfitIdOf(await saveStudioOutfit(variant.title, occasion, variant.items));
      setSavedOutfitId(id);
      return "Saved to your outfits.";
    });

  const wearToday = () =>
    run(async () => {
      if (!savedOutfitId) return "Save the look first.";
      await markOutfitWorn(savedOutfitId);
      return "Logged as worn today.";
    });

  const plan = (date: string) =>
    run(async () => {
      if (!savedOutfitId) return "Save the look first.";
      await planOutfit(savedOutfitId, date, occasion);
      return `Planned for ${date}.`;
    });

  return {
    savedOutfitId,
    busy,
    message,
    save,
    wearToday,
    plan,
    clearSaved: () => setSavedOutfitId(null),
  };
}
