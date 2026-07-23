import type { Dispatch, SetStateAction } from "react";

import { createApproveCrop } from "./approve-crop-action";
import { createApproveCutout } from "./approve-cutout-action";
import { createCandidateAction } from "./create-candidate-action";
import { createRegenerateCutout } from "./regenerate-cutout-action";
import { createRejectCandidate } from "./reject-candidate-action";
import { createSaveMetadata } from "./save-metadata-action";
import type { ImportJobView } from "./import-workspace.types";

export function useCandidateActions({
  job,
  setBusyAction,
  setError,
  refreshJob,
  startProcessing,
  setDirtyCandidates,
}: {
  job: ImportJobView | null;
  setBusyAction: Dispatch<SetStateAction<string | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  refreshJob: (jobId: string) => Promise<ImportJobView>;
  startProcessing: (jobId: string) => void;
  setDirtyCandidates: Dispatch<SetStateAction<Set<string>>>;
}) {
  const candidateAction = createCandidateAction({
    job,
    setBusyAction,
    setError,
    refreshJob,
    startProcessing,
  });
  return {
    approveCrop: createApproveCrop(job, candidateAction),
    approveCutout: createApproveCutout(job, candidateAction),
    regenerate: createRegenerateCutout(job, candidateAction),
    saveMetadata: createSaveMetadata(job, candidateAction),
    rejectCandidate: createRejectCandidate(job, candidateAction, setDirtyCandidates),
  };
}
