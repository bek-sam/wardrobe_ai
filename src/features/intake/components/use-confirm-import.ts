import { useCallback, type Dispatch, type SetStateAction } from "react";

import { requestJson } from "@/lib/api/request";

import { triggerWardrobeCompile } from "./trigger-wardrobe-compile";
import type { ImportJobView } from "./import-workspace.types";

export function useConfirmImport({
  job,
  setBusyAction,
  setError,
  refreshJob,
  setDirtyCandidates,
}: {
  job: ImportJobView | null;
  setBusyAction: Dispatch<SetStateAction<string | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  refreshJob: (jobId: string) => Promise<ImportJobView>;
  setDirtyCandidates: Dispatch<SetStateAction<Set<string>>>;
}) {
  return useCallback(async () => {
    if (!job) return;
    setBusyAction("confirm");
    setError(null);
    try {
      await requestJson<unknown>(`/api/imports/${encodeURIComponent(job.id)}/confirm`, {
        method: "POST",
      });
      triggerWardrobeCompile();
      await refreshJob(job.id);
      setDirtyCandidates(new Set());
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "The reviewed garments could not be saved.",
      );
    } finally {
      setBusyAction(null);
    }
  }, [job, refreshJob, setBusyAction, setDirtyCandidates, setError]);
}
