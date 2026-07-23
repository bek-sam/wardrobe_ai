import type { Dispatch, SetStateAction } from "react";

import { CandidateCard } from "./CandidateCard";
import type { BoundingBox, CandidateMetadata, CandidateView } from "./import-workspace.types";

export function CandidateGridItem({
  candidate,
  busy,
  setDirtyCandidates,
  onApproveCrop,
  onApproveCutout,
  onReject,
  onRegenerate,
  onSaveMetadata,
}: {
  candidate: CandidateView;
  busy: boolean;
  setDirtyCandidates: Dispatch<SetStateAction<Set<string>>>;
  onApproveCrop: (candidate: CandidateView, box: BoundingBox) => Promise<void>;
  onApproveCutout: (candidate: CandidateView) => Promise<void>;
  onReject: (candidate: CandidateView) => Promise<void>;
  onRegenerate: (candidate: CandidateView, instruction: string, tolerance: number) => Promise<void>;
  onSaveMetadata: (candidate: CandidateView, metadata: CandidateMetadata) => Promise<boolean>;
}) {
  return (
    <CandidateCard
      busy={busy}
      candidate={candidate}
      onApproveCrop={(box) => onApproveCrop(candidate, box)}
      onApproveCutout={() => onApproveCutout(candidate)}
      onDirty={(dirty) =>
        setDirtyCandidates((current) => {
          const next = new Set(current);
          if (dirty) next.add(candidate.id);
          else next.delete(candidate.id);
          return next;
        })
      }
      onReject={() => onReject(candidate)}
      onRegenerate={(instruction, tolerance) => onRegenerate(candidate, instruction, tolerance)}
      onSaveMetadata={(metadata) => onSaveMetadata(candidate, metadata)}
    />
  );
}
