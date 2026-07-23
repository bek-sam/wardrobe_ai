import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";

import { requestJson } from "@/lib/api/request";

import type { ImportJobView, UploadStage } from "./import-workspace.types";

export function useStartProcessing({
  processingJobsRef,
  setUploadStage,
  setError,
  refreshJob,
}: {
  processingJobsRef: MutableRefObject<Set<string>>;
  setUploadStage: Dispatch<SetStateAction<UploadStage>>;
  setError: Dispatch<SetStateAction<string | null>>;
  refreshJob: (jobId: string) => Promise<ImportJobView>;
}) {
  return useCallback(
    (jobId: string) => {
      if (processingJobsRef.current.has(jobId)) return;
      processingJobsRef.current.add(jobId);
      setUploadStage("processing");
      void requestJson<unknown>(`/api/imports/${encodeURIComponent(jobId)}/process`, {
        method: "POST",
      })
        .then(() => refreshJob(jobId))
        .catch((caught: unknown) => {
          setError(
            caught instanceof Error
              ? caught.message
              : "Processing paused. Your import is saved and can be retried.",
          );
        })
        .finally(() => {
          processingJobsRef.current.delete(jobId);
          setUploadStage("idle");
        });
    },
    [processingJobsRef, refreshJob, setError, setUploadStage],
  );
}
