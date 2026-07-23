import { useLoadExistingJob } from "./use-load-existing-job";
import { usePollJob } from "./use-poll-job";
import { useRefreshJob } from "./use-refresh-job";
import { useStartProcessing } from "./use-start-processing";
import type { useImportWorkspaceFields } from "./use-import-workspace-fields";

export function useImportWorkspaceProcessing(
  configured: boolean,
  fields: ReturnType<typeof useImportWorkspaceFields>,
) {
  const refreshJob = useRefreshJob(fields.setJob);
  const startProcessing = useStartProcessing({
    processingJobsRef: fields.processingJobsRef,
    setUploadStage: fields.setUploadStage,
    setError: fields.setError,
    refreshJob,
  });

  useLoadExistingJob({
    configured,
    setJob: fields.setJob,
    setError: fields.setError,
    setLoadingExisting: fields.setLoadingExisting,
    startProcessing,
  });
  usePollJob({ job: fields.job, refreshJob, setError: fields.setError });

  return { refreshJob, startProcessing };
}
