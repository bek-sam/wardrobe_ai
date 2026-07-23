import { Badge } from "@/components/ui/Badge";

import { CandidateGridItem } from "./CandidateGridItem";
import type { CandidateSectionProps } from "./import-workspace.types";

export function CandidateSection({
  candidates,
  busyAction,
  setDirtyCandidates,
  onApproveCrop,
  onApproveCutout,
  onReject,
  onRegenerate,
  onSaveMetadata,
}: CandidateSectionProps) {
  return (
    <section className="candidate-section" aria-labelledby="candidate-title">
      <div className="card-title-row">
        <div>
          <p className="eyebrow">Review required</p>
          <h2 id="candidate-title">
            {candidates.length} {candidates.length === 1 ? "garment" : "garments"} detected
          </h2>
        </div>
        <Badge tone="outline">Nothing saves without confirmation</Badge>
      </div>
      <div className="candidate-grid candidate-grid--review">
        {candidates.map((candidate) => (
          <CandidateGridItem
            busy={busyAction === candidate.id}
            candidate={candidate}
            key={candidate.id}
            onApproveCrop={onApproveCrop}
            onApproveCutout={onApproveCutout}
            onReject={onReject}
            onRegenerate={onRegenerate}
            onSaveMetadata={onSaveMetadata}
            setDirtyCandidates={setDirtyCandidates}
          />
        ))}
      </div>
    </section>
  );
}
