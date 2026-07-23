import type { ChangeEvent, RefObject } from "react";

import { LocalUploadPreview } from "./LocalUploadPreview";
import { UploadDropzone } from "./UploadDropzone";
import { UploadHintField } from "./UploadHintField";

export function ImportUploadSection({
  userHint,
  setUserHint,
  fileInput,
  cameraInput,
  dragging,
  setDragging,
  uploadStage,
  onSelectFile,
  onDropFile,
  localPreviewUrl,
}: {
  userHint: string;
  setUserHint: (value: string) => void;
  fileInput: RefObject<HTMLInputElement | null>;
  cameraInput: RefObject<HTMLInputElement | null>;
  dragging: boolean;
  setDragging: (value: boolean) => void;
  uploadStage: string;
  onSelectFile: (event: ChangeEvent<HTMLInputElement>) => void;
  onDropFile: (file: File) => void;
  localPreviewUrl: string | null;
}) {
  return (
    <>
      <UploadHintField onChange={setUserHint} userHint={userHint} />
      <UploadDropzone
        cameraInput={cameraInput}
        dragging={dragging}
        fileInput={fileInput}
        onDropFile={onDropFile}
        onSelectFile={onSelectFile}
        setDragging={setDragging}
        uploadStage={uploadStage}
      />
      {localPreviewUrl ? (
        <LocalUploadPreview localPreviewUrl={localPreviewUrl} uploadStage={uploadStage} />
      ) : null}
    </>
  );
}
