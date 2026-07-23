import { requestJson } from "@/lib/api/request";
import type { Dispatch, SetStateAction } from "react";

import { candidatePath } from "./candidate-path";
import type { createCandidateAction } from "./create-candidate-action";
import type { CandidateView, ImportJobView } from "./import-workspace.types";

export function createRejectCandidate(
  job: ImportJobView | null,
  candidateAction: ReturnType<typeof createCandidateAction>,
  setDirtyCandidates: Dispatch<SetStateAction<Set<string>>>,
) {
  return async function rejectCandidate(candidate: CandidateView) {
    if (!job || !window.confirm(`Skip ${candidate.metadata.name}? It will not be saved.`)) {
      return;
    }
    const rejected = await candidateAction(candidate, () =>
      requestJson<unknown>(candidatePath(job.id, candidate.id), { method: "DELETE" }),
    );
    if (rejected) {
      setDirtyCandidates((current) => {
        const next = new Set(current);
        next.delete(candidate.id);
        return next;
      });
    }
  };
}
