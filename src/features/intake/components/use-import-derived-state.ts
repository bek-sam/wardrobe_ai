import { useMemo } from "react";

import type { ImportJobView } from "./import-workspace.types";

export function useImportDerivedState(
  job: ImportJobView | null,
  dirtyCandidates: Set<string>,
  busyAction: string | null,
) {
  const currentStep = useMemo(() => {
    if (!job) return 1;
    if (["queued", "analyzing"].includes(job.status)) return 2;
    if (job.status === "complete") return 4;
    return 3;
  }, [job]);

  const canConfirm = Boolean(
    job &&
    job.status === "review_metadata" &&
    job.candidates.length > 0 &&
    job.candidates.every((candidate) =>
      ["review_metadata", "approved", "rejected"].includes(candidate.status),
    ) &&
    job.candidates.some((candidate) =>
      ["review_metadata", "approved"].includes(candidate.status),
    ) &&
    dirtyCandidates.size === 0 &&
    !busyAction,
  );

  const activeProcessing = Boolean(
    job &&
    (["queued", "analyzing", "extracting", "researching"].includes(job.status) ||
      job.candidates.some((candidate) => candidate.status === "extracting")),
  );

  return { currentStep, canConfirm, activeProcessing };
}
