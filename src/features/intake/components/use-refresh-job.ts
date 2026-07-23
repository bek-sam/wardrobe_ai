import { useCallback, type Dispatch, type SetStateAction } from "react";

import { requestJson } from "@/lib/api/request";

import { normalizeJob } from "./normalize-import-job";
import type { ImportJobView } from "./import-workspace.types";

export function useRefreshJob(setJob: Dispatch<SetStateAction<ImportJobView | null>>) {
  return useCallback(
    async (jobId: string) => {
      const raw = await requestJson<unknown>(`/api/imports/${encodeURIComponent(jobId)}`);
      const next = normalizeJob(raw);
      if (!next) throw new Error("The import job response was not valid.");
      setJob(next);
      return next;
    },
    [setJob],
  );
}
