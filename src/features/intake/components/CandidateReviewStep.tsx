import { CropReview } from "./CropReview";
import { CutoutReview } from "./CutoutReview";
import { MetadataReview } from "./MetadataReview";
import type { CandidateCardProps } from "./import-workspace.types";

export function CandidateReviewStep(props: CandidateCardProps) {
  const { candidate, busy, onDirty, onApproveCrop, onApproveCutout, onRegenerate, onSaveMetadata } =
    props;
  if (candidate.status === "review_crop") {
    return <CropReview busy={busy} candidate={candidate} onApprove={onApproveCrop} />;
  }
  if (candidate.status === "review_cutout" || candidate.status === "failed") {
    return (
      <CutoutReview
        busy={busy}
        candidate={candidate}
        onApprove={onApproveCutout}
        onRegenerate={onRegenerate}
      />
    );
  }
  if (candidate.status === "review_metadata") {
    return (
      <MetadataReview
        busy={busy}
        candidate={candidate}
        onDirty={onDirty}
        onRegenerate={onRegenerate}
        onSave={onSaveMetadata}
      />
    );
  }
  return null;
}
