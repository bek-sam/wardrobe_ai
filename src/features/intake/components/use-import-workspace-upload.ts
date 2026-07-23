import { useClearPreviewOnJobImage } from "./use-clear-preview-on-job-image";
import { useLocalPreview } from "./use-local-preview";
import { usePasteListener } from "./use-paste-listener";
import { useProcessFile } from "./use-process-file";
import type { useImportWorkspaceFields } from "./use-import-workspace-fields";

export function useImportWorkspaceUpload(
  configured: boolean,
  fields: ReturnType<typeof useImportWorkspaceFields>,
  startProcessing: (jobId: string) => void,
) {
  const { localPreviewRef, localPreviewUrl, setLocalPreviewUrl, clearLocalPreview } =
    useLocalPreview();

  useClearPreviewOnJobImage({
    originalImageUrl: fields.job?.originalImageUrl,
    localPreviewRef,
    clearLocalPreview,
  });

  const processFile = useProcessFile(fields.uploadLockRef, localPreviewRef, {
    configured,
    loadingExisting: fields.loadingExisting,
    job: fields.job,
    uploadStage: fields.uploadStage,
    busyAction: fields.busyAction,
    userHint: fields.userHint,
    clearLocalPreview,
    setLocalPreviewUrl,
    setDirtyCandidates: fields.setDirtyCandidates,
    setJob: fields.setJob,
    setUploadStage: fields.setUploadStage,
    setError: fields.setError,
    startProcessing,
  });
  usePasteListener(configured, processFile);

  return { localPreviewUrl, clearLocalPreview, processFile };
}
