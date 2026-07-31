"use client";

import type { StudioState } from "../hooks/studio-state.types";

/**
 * Status transitions are announced politely; nothing here is an actionable
 * failure, so nothing here interrupts a screen reader.
 */
export function StudioNotices({ studio }: { studio: StudioState }) {
  const { result, error, busy, variants } = studio.variants;

  return (
    <div aria-live="polite" className="studio-notices">
      {error ? (
        <p className="inline-feedback inline-feedback--error">
          <span>{error}</span>
        </p>
      ) : null}

      {busy ? <p className="studio-notices__status">Looking through your wardrobe…</p> : null}

      {result?.contextSummary ? (
        <p className="studio-notices__context">{result.contextSummary}</p>
      ) : null}

      {result?.shortfallReason ? (
        <p className="inline-feedback">
          <span>{result.shortfallReason}</span>
        </p>
      ) : null}

      {!busy && !result ? (
        <p className="studio-notices__empty">
          Describe where you are going — or press Surprise me — and you will get three complete
          looks built only from pieces you already own.
        </p>
      ) : null}

      {studio.actions.message ? (
        <p className="inline-feedback inline-feedback--success">
          <span>{studio.actions.message}</span>
        </p>
      ) : null}

      {variants.length > 0 && studio.locks.locked.length > 0 ? (
        <p className="studio-notices__locks">
          {studio.locks.locked.length} piece{studio.locks.locked.length === 1 ? "" : "s"} locked.
          Remix will keep {studio.locks.locked.length === 1 ? "it" : "them"} exactly.
        </p>
      ) : null}
    </div>
  );
}
