import { useCallback, type MutableRefObject } from "react";

import { runFileUpload } from "./run-file-upload";
import { validateImportFile } from "./validate-import-file";
import type { ProcessFileParams } from "./import-workspace.types";

export function useProcessFile(
  uploadLockRef: MutableRefObject<boolean>,
  localPreviewRef: MutableRefObject<string | null>,
  params: ProcessFileParams,
) {
  return useCallback(
    async (file: File) => {
      const { configured, loadingExisting, job, uploadStage, busyAction } = params;
      if (
        !configured ||
        loadingExisting ||
        job ||
        uploadStage !== "idle" ||
        busyAction ||
        uploadLockRef.current
      ) {
        return;
      }
      uploadLockRef.current = true;
      params.setError(null);
      const validationError = validateImportFile(file);
      if (validationError) {
        params.setError(validationError);
        uploadLockRef.current = false;
        return;
      }
      await runFileUpload({ file, localPreviewRef, ...params });
      uploadLockRef.current = false;
    },
    [localPreviewRef, params, uploadLockRef],
  );
}
