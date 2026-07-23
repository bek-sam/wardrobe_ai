import { requestJson } from "@/lib/api/request";

import { candidatePath } from "./candidate-path";
import type { createCandidateAction } from "./create-candidate-action";
import type { CandidateView, ImportJobView } from "./import-workspace.types";

export function createApproveCutout(
  job: ImportJobView | null,
  candidateAction: ReturnType<typeof createCandidateAction>,
) {
  return async function approveCutout(candidate: CandidateView) {
    if (!job) return;
    await candidateAction(candidate, () =>
      requestJson<unknown>(candidatePath(job.id, candidate.id, "/approve-cutout"), {
        method: "POST",
      }),
    );
  };
}
