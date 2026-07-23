import type { ChangeEvent, RefObject } from "react";

export function UploadFileInputs({
  fileInput,
  cameraInput,
  onSelectFile,
}: {
  fileInput: RefObject<HTMLInputElement | null>;
  cameraInput: RefObject<HTMLInputElement | null>;
  onSelectFile: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <>
      <input
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={onSelectFile}
        ref={fileInput}
        type="file"
      />
      <input
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="sr-only"
        onChange={onSelectFile}
        ref={cameraInput}
        type="file"
      />
    </>
  );
}
