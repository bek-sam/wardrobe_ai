import { useRef, useState } from "react";

import type { ImportJobView, UploadStage } from "./import-workspace.types";

export function useImportWorkspaceFields(configured: boolean) {
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const processingJobsRef = useRef(new Set<string>());
  const uploadLockRef = useRef(false);

  const [job, setJob] = useState<ImportJobView | null>(null);
  const [userHint, setUserHint] = useState("");
  const [dragging, setDragging] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(configured);
  const [uploadStage, setUploadStage] = useState<UploadStage>("idle");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirtyCandidates, setDirtyCandidates] = useState<Set<string>>(new Set());

  return {
    fileInput,
    cameraInput,
    processingJobsRef,
    uploadLockRef,
    job,
    setJob,
    userHint,
    setUserHint,
    dragging,
    setDragging,
    loadingExisting,
    setLoadingExisting,
    uploadStage,
    setUploadStage,
    busyAction,
    setBusyAction,
    error,
    setError,
    dirtyCandidates,
    setDirtyCandidates,
  };
}
