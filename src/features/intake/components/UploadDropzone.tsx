import { SpinnerGap, UploadSimple } from "@phosphor-icons/react";

import { createDragDropHandlers } from "./drag-drop-handlers";
import { titleCase } from "./import-text-helpers";
import { UploadDropzoneButtons } from "./UploadDropzoneButtons";
import { UploadFileInputs } from "./UploadFileInputs";
import type { UploadDropzoneProps } from "./import-workspace.types";

export function UploadDropzone({
  fileInput,
  cameraInput,
  dragging,
  setDragging,
  uploadStage,
  onSelectFile,
  onDropFile,
}: UploadDropzoneProps) {
  return (
    <section
      aria-labelledby="upload-title"
      className={`upload-zone${dragging ? " is-dragging" : ""}`}
      {...createDragDropHandlers(setDragging, onDropFile)}
    >
      <div className="upload-zone__icon">
        {uploadStage === "idle" ? (
          <UploadSimple size={31} weight="light" />
        ) : (
          <SpinnerGap className="spin" size={31} weight="light" />
        )}
      </div>
      <h2 id="upload-title">
        {uploadStage === "idle" ? "Drop a clothing photo here" : titleCase(uploadStage)}
      </h2>
      <p>Choose JPG, PNG, or WebP. Use a clear image under 20 MB for the best result.</p>
      <UploadDropzoneButtons
        cameraInput={cameraInput}
        fileInput={fileInput}
        uploadStage={uploadStage}
      />
      <small>Or paste an image from your clipboard</small>
      <UploadFileInputs
        cameraInput={cameraInput}
        fileInput={fileInput}
        onSelectFile={onSelectFile}
      />
    </section>
  );
}
