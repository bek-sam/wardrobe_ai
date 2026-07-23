import { Camera, ImageSquare } from "@phosphor-icons/react";
import type { RefObject } from "react";

import { Button } from "@/components/ui/Button";

export function UploadDropzoneButtons({
  fileInput,
  cameraInput,
  uploadStage,
}: {
  fileInput: RefObject<HTMLInputElement | null>;
  cameraInput: RefObject<HTMLInputElement | null>;
  uploadStage: string;
}) {
  return (
    <div>
      <Button disabled={uploadStage !== "idle"} onClick={() => fileInput.current?.click()}>
        <ImageSquare size={16} /> Choose photo
      </Button>
      <Button
        disabled={uploadStage !== "idle"}
        onClick={() => cameraInput.current?.click()}
        variant="secondary"
      >
        <Camera size={16} /> Use camera
      </Button>
    </div>
  );
}
