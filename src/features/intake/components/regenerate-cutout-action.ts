import { requestJson } from "@/lib/api/request";

import { candidatePath } from "./candidate-path";
import type { createCandidateAction } from "./create-candidate-action";
import type { CandidateView, ImportJobView } from "./import-workspace.types";

export function createRegenerateCutout(
  job: ImportJobView | null,
  candidateAction: ReturnType<typeof createCandidateAction>,
) {
  return async function regenerate(
    candidate: CandidateView,
    instruction: string,
    tolerance: number,
  ) {
    if (!job) return;
    await candidateAction(
      candidate,
      () =>
        requestJson<unknown>(candidatePath(job.id, candidate.id, "/regenerate-cutout"), {
          method: "POST",
          body: JSON.stringify({
            instruction: instruction.trim() || null,
            cleanupTolerance: tolerance,
          }),
        }),
      true,
    );
  };
}
