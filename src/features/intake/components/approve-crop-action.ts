import { requestJson } from "@/lib/api/request";

import { candidatePath } from "./candidate-path";
import type { createCandidateAction } from "./create-candidate-action";
import type { BoundingBox, CandidateView, ImportJobView } from "./import-workspace.types";

export function createApproveCrop(
  job: ImportJobView | null,
  candidateAction: ReturnType<typeof createCandidateAction>,
) {
  return async function approveCrop(candidate: CandidateView, boundingBox: BoundingBox) {
    if (!job) return;
    await candidateAction(
      candidate,
      async () => {
        const root = candidatePath(job.id, candidate.id);
        await requestJson<unknown>(root, {
          method: "PATCH",
          body: JSON.stringify({ boundingBox }),
        });
        await requestJson<unknown>(`${root}/approve-crop`, { method: "POST" });
      },
      true,
    );
  };
}
