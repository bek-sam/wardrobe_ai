import { Check, WarningCircle } from "@phosphor-icons/react";

import { Button } from "@/components/ui/Button";

import { RegeneratePanel } from "./RegeneratePanel";
import type { CutoutReviewProps } from "./import-workspace.types";

export function CutoutReview({ candidate, busy, onApprove, onRegenerate }: CutoutReviewProps) {
  return (
    <div className="candidate-review-form">
      <p className="candidate-review-copy">
        Approve when the full garment and its color look right, or describe what the next cutout
        should fix.
      </p>
      {candidate.errorMessage ? (
        <p className="inline-feedback inline-feedback--error">
          <WarningCircle size={15} /> {candidate.errorMessage}
        </p>
      ) : null}
      {candidate.status !== "failed" ? (
        <Button disabled={busy} onClick={() => void onApprove()}>
          <Check size={15} /> Approve cutout
        </Button>
      ) : null}
      <RegeneratePanel
        busy={busy}
        initialTolerance={candidate.cleanupTolerance}
        onRegenerate={onRegenerate}
        open={candidate.status === "failed"}
      />
    </div>
  );
}
