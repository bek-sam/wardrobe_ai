import { useEffect, type Dispatch, type SetStateAction } from "react";

import type { ImportJobView } from "./import-workspace.types";

export function usePollJob({
  job,
  refreshJob,
  setError,
}: {
  job: ImportJobView | null;
  refreshJob: (jobId: string) => Promise<ImportJobView>;
  setError: Dispatch<SetStateAction<string | null>>;
}) {
  useEffect(() => {
    if (!job || ["complete", "cancelled"].includes(job.status)) return;
    const activelyProcessing =
      ["queued", "analyzing", "extracting", "researching"].includes(job.status) ||
      job.candidates.some((candidate) => candidate.status === "extracting");
    const interval = window.setInterval(
      () => {
        void refreshJob(job.id).catch((caught: unknown) => {
          setError(
            caught instanceof Error ? caught.message : "Import progress could not be refreshed.",
          );
        });
      },
      activelyProcessing ? 1800 : Math.min(240_000, Math.max(60_000, job.signedUrlExpiresIn * 500)),
    );
    return () => window.clearInterval(interval);
  }, [job, refreshJob, setError]);
}
