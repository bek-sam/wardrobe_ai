"use client";

import { useEffect, useRef, useState } from "react";

import { fetchVisualization } from "../api/tryon-client";
import type { StudioVisualization } from "../types";
import { hiddenTabInterval, pollIntervalFor } from "./poll-interval";

type PollState = { id: string; visualization: StudioVisualization | null; error: string | null };

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
