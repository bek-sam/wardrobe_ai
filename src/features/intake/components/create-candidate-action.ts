import type { Dispatch, SetStateAction } from "react";

import type { CandidateView, ImportJobView } from "./import-workspace.types";

export function createCandidateAction({
  job,
  setBusyAction,
  setError,
  refreshJob,
  startProcessing,
}: {
  job: ImportJobView | null;
  setBusyAction: Dispatch<SetStateAction<string | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  refreshJob: (jobId: string) => Promise<ImportJobView>;
  startProcessing: (jobId: string) => void;
}) {
  return async function candidateAction(
    candidate: CandidateView,
    action: () => Promise<unknown>,
    processAfter = false,
  ) {
    if (!job) return false;
    setBusyAction(candidate.id);
    setError(null);
    try {
      await action();
      const refreshed = await refreshJob(job.id);
      if (processAfter) startProcessing(refreshed.id);
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The review action could not be saved.");
      return false;
    } finally {
      setBusyAction(null);
    }
  };
}
