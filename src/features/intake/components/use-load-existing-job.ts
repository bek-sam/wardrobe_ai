import { useEffect, type Dispatch, type SetStateAction } from "react";

import { requestJson } from "@/lib/api/request";

import { findResumableJob, resumableJobNeedsProcessing } from "./find-resumable-job";
import { normalizeJob } from "./normalize-import-job";
import type { ImportJobView } from "./import-workspace.types";

export function useLoadExistingJob({
  configured,
  setJob,
  setError,
  setLoadingExisting,
  startProcessing,
}: {
  configured: boolean;
  setJob: Dispatch<SetStateAction<ImportJobView | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setLoadingExisting: Dispatch<SetStateAction<boolean>>;
  startProcessing: (jobId: string) => void;
}) {
  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    void requestJson<unknown[]>("/api/imports")
      .then((rawJobs) => {
        if (cancelled) return;
        const jobs = rawJobs
          .map(normalizeJob)
          .filter((entry): entry is ImportJobView => entry !== null);
        const resumable = findResumableJob(jobs);
        if (resumable) {
          setJob(resumable);
          if (resumableJobNeedsProcessing(resumable)) startProcessing(resumable.id);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "Existing imports could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingExisting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [configured, setError, setJob, setLoadingExisting, startProcessing]);
}
