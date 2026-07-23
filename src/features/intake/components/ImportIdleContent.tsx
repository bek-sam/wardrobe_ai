import { ImportLoadingCard } from "./ImportLoadingCard";
import { ImportUploadSection } from "./ImportUploadSection";
import type { useImportWorkspaceState } from "./use-import-workspace-state";

export function ImportIdleContent({
  state,
}: {
  state: ReturnType<typeof useImportWorkspaceState>;
}) {
  const { fields, upload } = state;
  if (fields.loadingExisting) return <ImportLoadingCard />;
  return (
    <ImportUploadSection
      cameraInput={fields.cameraInput}
      dragging={fields.dragging}
      fileInput={fields.fileInput}
      localPreviewUrl={upload.localPreviewUrl}
      onDropFile={(file) => void upload.processFile(file)}
      onSelectFile={(event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (file) void upload.processFile(file);
      }}
      setDragging={fields.setDragging}
      setUserHint={fields.setUserHint}
      uploadStage={fields.uploadStage}
      userHint={fields.userHint}
    />
  );
}
