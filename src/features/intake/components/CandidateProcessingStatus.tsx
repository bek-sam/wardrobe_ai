import { Check, SpinnerGap, X } from "@phosphor-icons/react";

import type { CandidateStatus } from "./import-workspace.types";

export function CandidateProcessingStatus({ status }: { status: CandidateStatus }) {
  if (["detected", "extracting", "researching"].includes(status)) {
    return (
      <div className="candidate-processing" aria-live="polite">
        <SpinnerGap className="spin" size={18} />
        <span>
          {status === "extracting"
            ? "Creating a clean private cutout…"
            : "Processing this garment…"}
        </span>
      </div>
    );
  }
  if (status === "approved") {
    return (
      <p className="inline-feedback inline-feedback--success">
        <Check size={16} /> Saved to your wardrobe
      </p>
    );
  }
  if (status === "rejected") {
    return (
      <p className="inline-feedback">
        <X size={16} /> Skipped — this garment will not be saved
      </p>
    );
  }
  return null;
}
