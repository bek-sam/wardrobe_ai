"use client";

import type { StudioVisualization } from "../types";
import { InteractiveTryOnImage } from "./InteractiveTryOnImage";
import { StaleTryOnNotice } from "./StaleTryOnNotice";
import { TryOnFeedback } from "./TryOnFeedback";

type Props = {
  visualization: StudioVisualization;
  selectedItemId: string | null;
  busy: boolean;
  onSelect: (itemId: string) => void;
  onRegenerate: () => void;
};

export function TryOnReady({ visualization, selectedItemId, busy, onSelect, onRegenerate }: Props) {
  return (
    <div className="tryon-ready">
      {visualization.status === "stale" ? (
        <StaleTryOnNotice
          busy={busy}
          onRegenerate={onRegenerate}
          staleReason={visualization.staleReason}
        />
      ) : null}

      {visualization.imageUrl ? (
        <InteractiveTryOnImage
          garments={visualization.garments}
          imageUrl={visualization.imageUrl}
          onSelect={onSelect}
          selectedItemId={selectedItemId}
        />
      ) : null}

      <p className="tryon-disclaimer">{visualization.disclaimer}</p>

      <div className="tryon-ready__actions">
        <a
          className="button button--ghost button--small"
          download
          href={`/api/outfit-visualizations/${visualization.id}/download`}
        >
          Download privately
        </a>
      </div>

      <TryOnFeedback visualizationId={visualization.id} />
    </div>
  );
}
