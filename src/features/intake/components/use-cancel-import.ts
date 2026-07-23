import { useCallback, type Dispatch, type SetStateAction } from "react";

import { errorMessage } from "@/lib/api/request";

import type { ImportJobView } from "./import-workspace.types";

export function useCancelImport({
  job,
  setBusyAction,
  setError,
  setJob,
  clearLocalPreview,
}: {
  job: ImportJobView | null;
  setBusyAction: Dispatch<SetStateAction<string | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setJob: Dispatch<SetStateAction<ImportJobView | null>>;
  clearLocalPreview: () => void;
}) {
  return useCallback(async () => {
    if (!job) return;
    if (!window.confirm("Cancel this import? No garments from it will be saved.")) return;
    setBusyAction("cancel");
    setError(null);
    try {
      const response = await fetch(`/api/imports/${encodeURIComponent(job.id)}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(errorMessage(payload, "The import could not be cancelled."));
      }
      setJob((current) => (current ? { ...current, status: "cancelled" } : null));
      clearLocalPreview();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The import could not be cancelled.");
    } finally {
      setBusyAction(null);
    }
  }, [clearLocalPreview, job, setBusyAction, setError, setJob]);
}
