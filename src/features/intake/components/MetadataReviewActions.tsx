import { ArrowClockwise, Check, SpinnerGap } from "@phosphor-icons/react";

import { Button } from "@/components/ui/Button";

export function MetadataReviewActions({
  busy,
  canSubmit,
  regenerationOpen,
  onToggleRegeneration,
  onRegenerate,
  cleanupTolerance,
}: {
  busy: boolean;
  canSubmit: boolean;
  regenerationOpen: boolean;
  onToggleRegeneration: () => void;
  onRegenerate: (instruction: string, tolerance: number) => Promise<void>;
  cleanupTolerance: number;
}) {
  return (
    <>
      <div className="metadata-review-form__actions">
        <Button disabled={busy || !canSubmit} type="submit">
          {busy ? <SpinnerGap className="spin" size={15} /> : <Check size={15} />}
          Save reviewed details
        </Button>
        <Button onClick={onToggleRegeneration} type="button" variant="ghost">
          <ArrowClockwise size={15} /> Improve cutout
        </Button>
      </div>
      {regenerationOpen ? (
        <div className="metadata-regenerate">
          <p>Regeneration keeps your saved metadata separate until you review the new cutout.</p>
          <Button
            disabled={busy}
            onClick={() =>
              void onRegenerate(
                "Preserve the complete garment and its visible colors.",
                cleanupTolerance,
              )
            }
            type="button"
            variant="secondary"
          >
            Regenerate cutout
          </Button>
        </div>
      ) : null}
    </>
  );
}
