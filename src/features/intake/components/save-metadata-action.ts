import { requestJson } from "@/lib/api/request";

import { candidatePath } from "./candidate-path";
import type { createCandidateAction } from "./create-candidate-action";
import type { CandidateMetadata, CandidateView, ImportJobView } from "./import-workspace.types";

export function createSaveMetadata(
  job: ImportJobView | null,
  candidateAction: ReturnType<typeof createCandidateAction>,
) {
  return async function saveMetadata(candidate: CandidateView, metadata: CandidateMetadata) {
    if (!job) return false;
    return candidateAction(candidate, () =>
      requestJson<unknown>(candidatePath(job.id, candidate.id), {
        method: "PATCH",
        body: JSON.stringify({ metadata }),
      }),
    );
  };
}
