"use client";

import { TryOnBlockedByCutout, TryOnIdle } from "./TryOnIdle";
import { TryOnConsentGate } from "./TryOnConsentGate";
import { TryOnProgress } from "./TryOnProgress";
import { TryOnReady } from "./TryOnReady";
import { TryOnStatusNotice } from "./TryOnStatusNotice";
import type { TryOnStageProps } from "./tryon-stage.types";

/**
 * Maps the visualization state machine onto exactly one view. Every branch is
 * explicit: there is no state that renders a blank frame with a spinner and no
 * explanation.
 */
export function TryOnStage(props: TryOnStageProps) {
  const { variant, visualization, busy } = props;

  if (!variant.canVisualize) return <TryOnBlockedByCutout />;
  if (props.needsSetup) return <TryOnConsentGate onReady={props.onStart} />;
  if (!visualization) {
    return <TryOnIdle busy={busy} notice={props.notice} onStart={props.onStart} />;
  }

  if (visualization.inFlight) {
    return (
      <div aria-live="polite">
        <TryOnProgress status={visualization.status} />
      </div>
    );
  }

  if (visualization.status === "ready" || visualization.status === "stale") {
    return (
      <TryOnReady
        busy={busy}
        onRegenerate={props.onRetry}
        onSelect={props.onSelect}
        selectedItemId={props.selectedItemId}
        visualization={visualization}
      />
    );
  }

  return (
    <TryOnStatusNotice
      busy={busy}
      errorCode={visualization.errorCode}
      errorSummary={visualization.errorSummary}
      onBackToFlatLay={props.onBackToFlatLay}
      onChangeOutfit={props.onBackToFlatLay}
      onChangePhoto={props.onBackToFlatLay}
      onRetry={props.onRetry}
    />
  );
}
