"use client";

import type { SwapCandidate } from "../api";
import type { StudioVariant, StudioVariantsResponse } from "../types";
import type { VisualizationOutcome } from "../api";
import { useCallback, useState } from "react";
import type { OutfitItemRole } from "@/features/outfits";
import { useEffect, useRef } from "react";
import { TRYON_POLL_INTERVALS_MS } from "@/lib/visualization";
import { fetchVisualization } from "../api";
import type { StudioVisualization } from "../types";
import {
  createVisualization,
  processVisualizationInline,
  regenerateVisualization,
  type SnapshotSelection,
} from "../api";
import { fetchOutfitVariants, type StudioRequestInput } from "../api";
import type { OutfitVariantMode } from "../types";
import { requestJson } from "@/lib/api/request";
import type { StudioVariantItem } from "../types";

/**
 * Replaces one garment in one variant, keeping its role and position. A swap
 * is local and immediate — the flat lay updates at once — and the server still
 * revalidates the whole look before anything is saved or rendered.
 */
export function applySwap(
  result: StudioVariantsResponse,
  candidateId: string,
  fromItemId: string,
  replacement: SwapCandidate,
): StudioVariantsResponse {
  const swapVariant = (variant: StudioVariant): StudioVariant => {
    if (variant.candidateId !== candidateId) return variant;
    return {
      ...variant,
      items: variant.items.map((item) =>
        item.itemId === fromItemId
          ? {
              ...item,
              itemId: replacement.id,
              name: replacement.name,
              category: replacement.category,
              // Colours and pattern are unknown from the picker's compact
              // record; the detail sheet reads the authoritative values from
              // the wardrobe row, so leaving them empty is honest rather than
              // inventing them here.
              colorNames: [],
              primaryColorHex: null,
              pattern: null,
              availabilityStatus: "available",
              favorite: false,
              wearCount: 0,
            }
          : item,
      ),
      // A swapped look is no longer the one the stylist explained, so the
      // stylist note is dropped rather than left attached to a different look.
      stylistNote: "You swapped a piece into this look.",
    };
  };

  return { ...result, variants: result.variants.map(swapVariant) };
}

/**
 * One message per outcome. "Queue full" and "quota reached" are deliberately
 * distinct from "already ready" — collapsing them was the bug this replaces,
 * and it left users believing an image existed when none had been made.
 */
export function outcomeNotice(outcome: VisualizationOutcome): string | null {
  switch (outcome.outcome) {
    case "created":
      return "Creating your try-on. This usually takes a minute or two.";
    case "reused":
      return "A try-on for this exact look is already being made.";
    case "already_fresh":
      return null;
    case "queue_full":
      return "You already have the maximum number of try-ons in progress. Wait for one to finish.";
    case "quota_exhausted":
      return outcome.resetAt
        ? `You've used today's try-ons. They reset at ${new Date(outcome.resetAt).toLocaleTimeString()}.`
        : "You've used today's try-ons. They reset tomorrow.";
    case "conflict":
      return outcome.reason ?? "This look changed and can no longer be rendered.";
    case "needs_identity":
      return "Add a reference photo before creating a try-on.";
    case "needs_consent":
      return "Review and accept the try-on consent to continue.";
    default:
      return "The try-on could not be started.";
  }
}

export function outcomeNeedsSetup(outcome: VisualizationOutcome): boolean {
  return outcome.outcome === "needs_identity" || outcome.outcome === "needs_consent";
}

/** The two centre-stage views. Switching between them preserves all state. */
export type StudioMode = "flat-lay" | "try-on";

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

type PollState = { id: string; visualization: StudioVisualization | null; error: string | null };

/** 1.5s, then 3s, then 5s, capped at 5s — matching the documented cadence. */
function pollIntervalFor(attempt: number): number {
  const index = Math.min(attempt, TRYON_POLL_INTERVALS_MS.length - 1);
  return TRYON_POLL_INTERVALS_MS[index] ?? 5_000;
}

/**
 * A hidden tab still needs the eventual answer, but not at interactive speed:
 * back off hard rather than stopping, so a user who tabs away and back is not
 * left staring at a stale "generating" until the next fast tick.
 */
function hiddenTabInterval(interval: number): number {
  return Math.max(interval, 15_000);
}

/**
 * Polls one visualization until it reaches a terminal state. Survives a page
 * reload because the id is the only state it needs, and refreshes immediately
 * when the tab becomes visible again rather than waiting out a hidden-tab tick.
 *
 * State is tagged with the id it belongs to and derived on render, so a result
 * for a previous visualization can never flash onto the current one.
 */
export function useVisualizationPoll(visualizationId: string | null) {
  const [state, setState] = useState<PollState | null>(null);
  const attemptRef = useRef(0);

  useEffect(() => {
    if (!visualizationId) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    attemptRef.current = 0;

    const tick = async () => {
      const next = await fetchVisualization(visualizationId, controller.signal).catch(
        (cause: unknown) => (controller.signal.aborted ? null : (cause as Error)),
      );
      if (next === null) return;
      const failed = next instanceof Error;
      setState({
        id: visualizationId,
        visualization: failed ? null : next,
        error: failed ? next.message : null,
      });
      if (!failed && !next.inFlight) return;
      const base = pollIntervalFor(attemptRef.current++);
      const hidden = document.visibilityState === "hidden";
      timer = setTimeout(tick, hidden ? hiddenTabInterval(base) : base);
    };

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      clearTimeout(timer);
      void tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    void tick();

    return () => {
      controller.abort();
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [visualizationId]);

  const current = state && state.id === visualizationId ? state : null;
  return { visualization: current?.visualization ?? null, error: current?.error ?? null };
}

/**
 * Owns the try-on request lifecycle. The visualization id is the only piece of
 * durable state, which is what lets the user navigate away and come back to a
 * generation still in flight.
 */
export function useTryOn() {
  const [visualizationId, setVisualizationId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [busy, setBusy] = useState(false);
  const { visualization, error } = useVisualizationPoll(visualizationId);

  const start = useCallback(async (items: readonly SnapshotSelection[]) => {
    setBusy(true);
    setNotice(null);
    setNeedsSetup(false);
    try {
      const outcome = await createVisualization(items);
      setNotice(outcomeNotice(outcome));
      setNeedsSetup(outcomeNeedsSetup(outcome));
      if (!outcome.visualizationId) return;
      setVisualizationId(outcome.visualizationId);
      if (outcome.outcome === "created") await processVisualizationInline(outcome.visualizationId);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "The try-on could not be started.");
    } finally {
      setBusy(false);
    }
  }, []);

  const retry = useCallback(async () => {
    if (!visualizationId) return;
    setBusy(true);
    try {
      setNotice(outcomeNotice(await regenerateVisualization(visualizationId)));
      await processVisualizationInline(visualizationId);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "The try-on could not be retried.");
    } finally {
      setBusy(false);
    }
  }, [visualizationId]);

  const reset = useCallback(() => setVisualizationId(null), []);

  return { visualization, visualizationId, notice, error, needsSetup, busy, start, retry, reset };
}

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

type UseStudioRequestDeps = {
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
export function useStudioRequest({ variants, locks, tryOn, onReset }: UseStudioRequestDeps) {
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

/** Saves the exact selection through the canonical create_user_outfit RPC. */
function saveStudioOutfit(
  name: string,
  occasion: string | null,
  items: readonly StudioVariantItem[],
) {
  return requestJson<{ id?: string } | string>("/api/outfits", {
    method: "POST",
    body: JSON.stringify({
      name,
      occasion,
      items: items.map((item, index) => ({
        item_id: item.itemId,
        role: item.role,
        sort_order: index,
      })),
    }),
  });
}

function markOutfitWorn(outfitId: string) {
  return requestJson<unknown>(`/api/outfits/${outfitId}/wear`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

function planOutfit(outfitId: string, plannedDate: string, occasion: string | null) {
  return requestJson<unknown>("/api/plans", {
    method: "POST",
    body: JSON.stringify({ outfit_id: outfitId, planned_date: plannedDate, occasion }),
  });
}

/** create_user_outfit returns either the row or the bare id, depending on shape. */
function savedOutfitIdOf(result: unknown): string | null {
  if (typeof result === "string") return result;
  const id = (result as { id?: unknown })?.id;
  return typeof id === "string" ? id : null;
}

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

type UseStudioDeps = {
  variants: ReturnType<typeof useVariants>;
  locks: ReturnType<typeof useLocks>;
  tryOn: ReturnType<typeof useTryOn>;
  onSwapped: (replacementId: string) => void;
};

/**
 * Swapping a piece updates the flat lay immediately and retires the previous
 * try-on: an image of the old combination must never be presented as the new
 * one. The lock on the removed item goes with it, since a lock names an exact
 * item id and that item is no longer in the look.
 */
function useStudioSwap({ variants, locks, tryOn, onSwapped }: UseStudioDeps) {
  return (fromItemId: string, replacement: SwapCandidate) => {
    const candidateId = variants.selected?.candidateId;
    if (candidateId) variants.swapItem(candidateId, fromItemId, replacement);
    locks.unlockItem(fromItemId);
    tryOn.reset();
    onSwapped(replacement.id);
  };
}

/** Which stage is showing, which garment is selected, and any open swap. */
function useStudioSelection() {
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

/** The exact ordered selection the visualization snapshot is built from. */
function snapshotSelection(items: readonly StudioVariantItem[]) {
  return items.map((item, index) => ({
    item_id: item.itemId,
    role: item.role,
    sort_order: index,
  }));
}

/**
 * One place that owns the studio's cross-cutting state, so switching between
 * Flat Lay and AI Try-On never discards the selection, the locks, or an
 * in-flight generation.
 */
export function useStudio(
  occasion: string | null,
  buildInput: (surprise?: boolean) => StudioRequestInput,
) {
  const [variants, locks, tryOn] = [useVariants(), useLocks(), useTryOn()];
  const actions = useOutfitActions(occasion);
  const selection = useStudioSelection();
  const { setStage, setSelectedItemId, setSwapping } = selection;
  const shared = { variants, locks, tryOn };

  const request = useStudioRequest({
    ...shared,
    onReset: () => {
      setSelectedItemId(null);
      setStage("flat-lay");
    },
  });

  const swapItem = useStudioSwap({
    ...shared,
    onSwapped: (replacementId) => {
      setSelectedItemId(replacementId);
      setSwapping(null);
    },
  });

  const startTryOn = () => {
    if (!variants.selected) return;
    setStage("try-on");
    void tryOn.start(snapshotSelection(variants.selected.items));
  };

  return {
    ...selection,
    remix: () => void request(buildInput()),
    swapItem,
    variants,
    locks,
    tryOn,
    actions,
    request,
    startTryOn,
  };
}

export type StudioState = ReturnType<typeof useStudio>;
