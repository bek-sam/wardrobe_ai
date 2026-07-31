"use client";

import { Button } from "@/components/ui/Button";

import { DEFAULT_FAILURE, FAILURE_COPY, type FailureAction } from "./failure-copy.data";

type Props = {
  errorCode: string | null;
  errorSummary: string | null;
  busy: boolean;
  onRetry: () => void;
  onChangePhoto: () => void;
  onChangeOutfit: () => void;
  onBackToFlatLay: () => void;
};

const ACTION_LABELS: Record<FailureAction, string> = {
  retry: "Try again",
  change_photo: "Change reference photo",
  change_outfit: "Change the outfit",
  flat_lay: "Back to flat lay",
};

/**
 * An actionable failure is announced assertively; everything else stays polite.
 * Only the actions that can actually resolve this specific failure are shown.
 */
export function TryOnStatusNotice({ errorCode, errorSummary, busy, ...handlers }: Props) {
  const copy = (errorCode && FAILURE_COPY[errorCode]) || DEFAULT_FAILURE;
  const handlerFor: Record<FailureAction, () => void> = {
    retry: handlers.onRetry,
    change_photo: handlers.onChangePhoto,
    change_outfit: handlers.onChangeOutfit,
    flat_lay: handlers.onBackToFlatLay,
  };

  return (
    <div aria-live="assertive" className="tryon-notice tryon-notice--error" role="alert">
      <p className="tryon-notice__title">{copy.title}</p>
      {errorSummary ? <p className="tryon-notice__detail">{errorSummary}</p> : null}
      <div className="tryon-notice__actions">
        {copy.actions.map((action) => (
          <Button
            className="button--small"
            disabled={busy}
            key={action}
            onClick={handlerFor[action]}
            variant={action === "retry" ? "primary" : "ghost"}
          >
            {ACTION_LABELS[action]}
          </Button>
        ))}
      </div>
    </div>
  );
}
