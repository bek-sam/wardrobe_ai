import { ImportJobPanel } from "./ImportJobPanel";
import type { ImportJobView } from "./import-workspace.types";
import type { useImportWorkspaceState } from "./use-import-workspace-state";

export function ImportJobContent({
  job,
  state,
}: {
  job: ImportJobView;
  state: ReturnType<typeof useImportWorkspaceState>;
}) {
  const { fields, derived, candidateActions, confirmImport } = state;
  return (
    <ImportJobPanel
      activelyProcessing={derived.activeProcessing || fields.uploadStage === "processing"}
      busyAction={fields.busyAction}
      canConfirm={derived.canConfirm}
      dirtyCandidates={fields.dirtyCandidates}
      job={job}
      onApproveCrop={candidateActions.approveCrop}
      onApproveCutout={candidateActions.approveCutout}
      onConfirm={() => void confirmImport()}
      onReject={candidateActions.rejectCandidate}
      onRegenerate={candidateActions.regenerate}
      onSaveMetadata={candidateActions.saveMetadata}
      onStartAnother={() => {
        fields.setJob(null);
        fields.setError(null);
        fields.setUserHint("");
        fields.setDirtyCandidates(new Set());
      }}
      onStartNew={() => {
        fields.setJob(null);
        fields.setError(null);
      }}
      setDirtyCandidates={fields.setDirtyCandidates}
    />
  );
}
