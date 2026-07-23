import type { Dispatch, MutableRefObject, SetStateAction } from "react";

import { uploadImportPhoto } from "./upload-import-photo";
import type { ImportJobView, UploadStage } from "./import-workspace.types";

export async function runFileUpload({
  file,
  userHint,
  localPreviewRef,
  clearLocalPreview,
  setLocalPreviewUrl,
  setDirtyCandidates,
  setJob,
  setUploadStage,
  setError,
  startProcessing,
}: {
  file: File;
  userHint: string;
  localPreviewRef: MutableRefObject<string | null>;
  clearLocalPreview: () => void;
  setLocalPreviewUrl: Dispatch<SetStateAction<string | null>>;
  setDirtyCandidates: Dispatch<SetStateAction<Set<string>>>;
  setJob: Dispatch<SetStateAction<ImportJobView | null>>;
  setUploadStage: Dispatch<SetStateAction<UploadStage>>;
  setError: Dispatch<SetStateAction<string | null>>;
  startProcessing: (jobId: string) => void;
}) {
  clearLocalPreview();
  const objectUrl = URL.createObjectURL(file);
  localPreviewRef.current = objectUrl;
  setLocalPreviewUrl(objectUrl);
  setDirtyCandidates(new Set());
  setJob(null);
  try {
    const created = await uploadImportPhoto(file, userHint, setUploadStage);
    setJob(created);
    startProcessing(created.id);
  } catch (caught) {
    setUploadStage("idle");
    setError(caught instanceof Error ? caught.message : "The image could not be uploaded.");
  }
}
