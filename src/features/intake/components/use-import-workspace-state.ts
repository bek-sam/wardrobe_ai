import { useCancelImport } from "./use-cancel-import";
import { useCandidateActions } from "./use-candidate-actions";
import { useConfirmImport } from "./use-confirm-import";
import { useImportDerivedState } from "./use-import-derived-state";
import { useImportWorkspaceFields } from "./use-import-workspace-fields";
import { useImportWorkspaceProcessing } from "./use-import-workspace-processing";
import { useImportWorkspaceUpload } from "./use-import-workspace-upload";

export function useImportWorkspaceState(configured: boolean) {
  const fields = useImportWorkspaceFields(configured);
  const { refreshJob, startProcessing } = useImportWorkspaceProcessing(configured, fields);
  const upload = useImportWorkspaceUpload(configured, fields, startProcessing);

  const candidateActions = useCandidateActions({
    job: fields.job,
    setBusyAction: fields.setBusyAction,
    setError: fields.setError,
    refreshJob,
    startProcessing,
    setDirtyCandidates: fields.setDirtyCandidates,
  });
  const confirmImport = useConfirmImport({
    job: fields.job,
    setBusyAction: fields.setBusyAction,
    setError: fields.setError,
    refreshJob,
    setDirtyCandidates: fields.setDirtyCandidates,
  });
  const cancelImport = useCancelImport({
    job: fields.job,
    setBusyAction: fields.setBusyAction,
    setError: fields.setError,
    setJob: fields.setJob,
    clearLocalPreview: upload.clearLocalPreview,
  });
  const derived = useImportDerivedState(fields.job, fields.dirtyCandidates, fields.busyAction);

  return {
    fields,
    upload,
    startProcessing,
    candidateActions,
    confirmImport,
    cancelImport,
    derived,
  };
}
