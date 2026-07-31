"use client";

import { useCallback, useState } from "react";

import {
  createVisualization,
  processVisualizationInline,
  regenerateVisualization,
  type SnapshotSelection,
} from "../api/tryon-client";
import { outcomeNeedsSetup, outcomeNotice } from "./outcome-notice";
import { useVisualizationPoll } from "./use-visualization-poll";

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
