import { X } from "@phosphor-icons/react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

import { CandidateImage } from "./CandidateImage";
import { CandidateProcessingStatus } from "./CandidateProcessingStatus";
import { CandidateReviewStep } from "./CandidateReviewStep";
import { confidenceLabel } from "./confidence-label";
import { titleCase } from "./import-text-helpers";
import type { CandidateCardProps } from "./import-workspace.types";

const reviewStatuses = ["review_crop", "review_cutout", "review_metadata", "failed"];

export function CandidateCard(props: CandidateCardProps) {
  const { candidate, busy, onReject } = props;
  const confidence = confidenceLabel(candidate.fieldConfidence);
  return (
    <Card as="article" className="candidate-card candidate-card--live" padded={false}>
      <CandidateImage candidate={candidate} />
      <div className="candidate-card__body">
        <div className="candidate-card__summary">
          <Badge tone={confidence.tone}>{confidence.label}</Badge>
          <h3>{candidate.metadata.name}</h3>
          <p>
            {titleCase(candidate.metadata.category)}
            {candidate.metadata.color_names.length
              ? ` · ${candidate.metadata.color_names.join(", ")}`
              : " · color needs review"}
          </p>
        </div>
        <CandidateReviewStep {...props} />
        <CandidateProcessingStatus status={candidate.status} />
        {reviewStatuses.includes(candidate.status) ? (
          <Button disabled={busy} onClick={() => void onReject()} type="button" variant="ghost">
            <X size={15} /> Skip this garment
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
