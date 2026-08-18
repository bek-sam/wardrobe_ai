import type { Dispatch, SetStateAction } from "react";
import { requestJson } from "@/lib/api/request";
import { isObject, safeColor, safeNullableString, safeString } from "@/lib/api/normalize";
import { uploadSignedFile } from "@/lib/api/signed-upload";
import type { MutableRefObject } from "react";
import { useRef, useState } from "react";
import { useCallback, useEffect } from "react";
import { useMemo } from "react";
import { errorMessage } from "@/lib/api/request";

export type JobStatus =
  | "queued"
  | "analyzing"
  | "review_crop"
  | "extracting"
  | "review_metadata"
  | "researching"
  | "complete"
  | "failed"
  | "cancelled";

export type CandidateStatus =
  | "detected"
  | "review_crop"
  | "extracting"
  | "review_cutout"
  | "review_metadata"
  | "researching"
  | "approved"
  | "rejected"
  | "failed";

export type BoundingBox = { x: number; y: number; width: number; height: number };

export type CandidateMetadata = {
  name: string;
  category: string;
  subcategory: string | null;
  primary_color_hex: string | null;
  secondary_color_hex: string | null;
  color_names: string[];
  pattern: string | null;
  silhouette: string | null;
  materials: Record<string, unknown>;
  visible_text: string[];
  season_tags: string[];
  occasion_tags: string[];
  notes: string;
};

export type CandidateView = {
  id: string;
  ordinal: number;
  status: CandidateStatus;
  boundingBox: BoundingBox;
  metadata: CandidateMetadata;
  fieldConfidence: Record<string, number>;
  cropUrl: string | null;
  cutoutUrl: string | null;
  failedCutoutUrl: string | null;
  modeledUrl: string | null;
  errorMessage: string | null;
  cleanupTolerance: number;
};

export type ImportJobView = {
  id: string;
  status: JobStatus;
  progress: number;
  errorMessage: string | null;
  originalImageUrl: string | null;
  signedUrlExpiresIn: number;
  candidates: CandidateView[];
};

export type SignedUpload = {
  bucket: string;
  path: string;
  signedUrl: string;
  token: string;
  requiredContentType: "image/jpeg" | "image/png" | "image/webp";
  maximumFileSize: number;
};

export type MetadataForm = {
  name: string;
  category: string;
  subcategory: string;
  primaryColorHex: string;
  secondaryColorHex: string;
  colorNames: string;
  pattern: string;
  silhouette: string;
  material: string;
  visibleText: string;
  seasonTags: string;
  occasionTags: string;
  notes: string;
};

export type UploadStage = "idle" | "signing" | "uploading" | "creating" | "processing";

export type ProcessFileParams = {
  configured: boolean;
  loadingExisting: boolean;
  job: ImportJobView | null;
  uploadStage: UploadStage;
  busyAction: string | null;
  userHint: string;
  clearLocalPreview: () => void;
  setLocalPreviewUrl: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  setDirtyCandidates: import("react").Dispatch<import("react").SetStateAction<Set<string>>>;
  setJob: import("react").Dispatch<import("react").SetStateAction<ImportJobView | null>>;
  setUploadStage: import("react").Dispatch<import("react").SetStateAction<UploadStage>>;
  setError: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  startProcessing: (jobId: string) => void;
};

export type MetadataSetField = <Key extends keyof MetadataForm>(
  key: Key,
  value: MetadataForm[Key],
) => void;

export type CropReviewProps = {
  candidate: CandidateView;
  busy: boolean;
  onApprove: (box: BoundingBox) => Promise<void>;
};

export type CutoutReviewProps = {
  candidate: CandidateView;
  busy: boolean;
  onApprove: () => Promise<void>;
  onRegenerate: (instruction: string, tolerance: number) => Promise<void>;
};

export type MetadataReviewProps = {
  candidate: CandidateView;
  busy: boolean;
  onDirty: (dirty: boolean) => void;
  onSave: (metadata: CandidateMetadata) => Promise<boolean>;
  onRegenerate: (instruction: string, tolerance: number) => Promise<void>;
};

export type CandidateSectionProps = {
  candidates: CandidateView[];
  busyAction: string | null;
  setDirtyCandidates: import("react").Dispatch<import("react").SetStateAction<Set<string>>>;
  onApproveCrop: (candidate: CandidateView, box: BoundingBox) => Promise<void>;
  onApproveCutout: (candidate: CandidateView) => Promise<void>;
  onReject: (candidate: CandidateView) => Promise<void>;
  onRegenerate: (candidate: CandidateView, instruction: string, tolerance: number) => Promise<void>;
  onSaveMetadata: (candidate: CandidateView, metadata: CandidateMetadata) => Promise<boolean>;
};

export type ImportJobPanelProps = Omit<CandidateSectionProps, "candidates"> & {
  job: ImportJobView;
  activelyProcessing: boolean;
  dirtyCandidates: Set<string>;
  canConfirm: boolean;
  onConfirm: () => void;
  onStartAnother: () => void;
  onStartNew: () => void;
};

export type UploadDropzoneProps = {
  fileInput: import("react").RefObject<HTMLInputElement | null>;
  cameraInput: import("react").RefObject<HTMLInputElement | null>;
  dragging: boolean;
  setDragging: (value: boolean) => void;
  uploadStage: string;
  onSelectFile: (event: import("react").ChangeEvent<HTMLInputElement>) => void;
  onDropFile: (file: File) => void;
};

export type CandidateCardProps = {
  candidate: CandidateView;
  busy: boolean;
  onDirty: (dirty: boolean) => void;
  onApproveCrop: (box: BoundingBox) => Promise<void>;
  onApproveCutout: () => Promise<void>;
  onReject: () => Promise<void>;
  onRegenerate: (instruction: string, tolerance: number) => Promise<void>;
  onSaveMetadata: (metadata: CandidateMetadata) => Promise<boolean>;
};

export function createCandidateAction({
  job,
  setBusyAction,
  setError,
  refreshJob,
  startProcessing,
}: {
  job: ImportJobView | null;
  setBusyAction: Dispatch<SetStateAction<string | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  refreshJob: (jobId: string) => Promise<ImportJobView>;
  startProcessing: (jobId: string) => void;
}) {
  return async function candidateAction(
    candidate: CandidateView,
    action: () => Promise<unknown>,
    processAfter = false,
  ) {
    if (!job) return false;
    setBusyAction(candidate.id);
    setError(null);
    try {
      await action();
      const refreshed = await refreshJob(job.id);
      if (processAfter) startProcessing(refreshed.id);
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The review action could not be saved.");
      return false;
    } finally {
      setBusyAction(null);
    }
  };
}

export function candidatePath(jobId: string, candidateId: string, suffix = "") {
  return `/api/imports/${encodeURIComponent(jobId)}/items/${encodeURIComponent(candidateId)}${suffix}`;
}

export function createApproveCrop(
  job: ImportJobView | null,
  candidateAction: ReturnType<typeof createCandidateAction>,
) {
  return async function approveCrop(candidate: CandidateView, boundingBox: BoundingBox) {
    if (!job) return;
    await candidateAction(
      candidate,
      async () => {
        const root = candidatePath(job.id, candidate.id);
        await requestJson<unknown>(root, {
          method: "PATCH",
          body: JSON.stringify({ boundingBox }),
        });
        await requestJson<unknown>(`${root}/approve-crop`, { method: "POST" });
      },
      true,
    );
  };
}

export function createApproveCutout(
  job: ImportJobView | null,
  candidateAction: ReturnType<typeof createCandidateAction>,
) {
  return async function approveCutout(candidate: CandidateView) {
    if (!job) return;
    await candidateAction(candidate, () =>
      requestJson<unknown>(candidatePath(job.id, candidate.id, "/approve-cutout"), {
        method: "POST",
      }),
    );
  };
}

export function createSaveMetadata(
  job: ImportJobView | null,
  candidateAction: ReturnType<typeof createCandidateAction>,
) {
  return async function saveMetadata(candidate: CandidateView, metadata: CandidateMetadata) {
    if (!job) return false;
    return candidateAction(candidate, () =>
      requestJson<unknown>(candidatePath(job.id, candidate.id), {
        method: "PATCH",
        body: JSON.stringify({ metadata }),
      }),
    );
  };
}

export function createRejectCandidate(
  job: ImportJobView | null,
  candidateAction: ReturnType<typeof createCandidateAction>,
  setDirtyCandidates: Dispatch<SetStateAction<Set<string>>>,
) {
  return async function rejectCandidate(candidate: CandidateView) {
    if (!job || !window.confirm(`Skip ${candidate.metadata.name}? It will not be saved.`)) return;
    const rejected = await candidateAction(candidate, () =>
      requestJson<unknown>(candidatePath(job.id, candidate.id), { method: "DELETE" }),
    );
    if (rejected) {
      setDirtyCandidates((current) => {
        const next = new Set(current);
        next.delete(candidate.id);
        return next;
      });
    }
  };
}

export const jobStatuses = new Set<JobStatus>([
  "queued",
  "analyzing",
  "review_crop",
  "extracting",
  "review_metadata",
  "researching",
  "complete",
  "failed",
  "cancelled",
]);

export const candidateStatuses = new Set<CandidateStatus>([
  "detected",
  "review_crop",
  "extracting",
  "review_cutout",
  "review_metadata",
  "researching",
  "approved",
  "rejected",
  "failed",
]);

export const categoryOptions = [
  "tops",
  "bottoms",
  "dresses",
  "outerwear",
  "shoes",
  "accessories",
  "bags",
  "activewear",
  "swimwear",
  "underwear",
  "other",
] as const;

export const steps = [
  { number: "1", title: "Upload", copy: "Original stays private" },
  { number: "2", title: "Detect", copy: "Find each garment" },
  { number: "3", title: "Review", copy: "You correct every detail" },
  { number: "4", title: "Save", copy: "Add approved pieces only" },
];

export function stringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string").slice(0, 50)
    : [];
}

export function safeSignedUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function safeInteger(value: unknown, fallback: number, minimum: number, maximum: number) {
  return typeof value === "number" && Number.isInteger(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback;
}

export function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function csv(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function materialName(materials: Record<string, unknown>) {
  if (typeof materials.apparent === "string") return materials.apparent;
  const match = Object.values(materials).find((value) => typeof value === "string");
  return typeof match === "string" ? match : "";
}

export function confidenceLabel(confidence: Record<string, number>) {
  const values = Object.values(confidence);
  if (!values.length) return { label: "Needs your review", tone: "outline" as const };
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (average >= 0.8) return { label: "High confidence", tone: "sage" as const };
  if (average >= 0.55) return { label: "Medium confidence", tone: "gold" as const };
  return { label: "Low confidence", tone: "rust" as const };
}

function normalizeMetadata(proposed: unknown, confirmed: unknown): CandidateMetadata {
  const first = isObject(proposed) ? proposed : {};
  const second = isObject(confirmed) ? confirmed : {};
  const merged = { ...first, ...second };
  return {
    name: safeString(merged.name, "Untitled garment"),
    category: safeString(merged.category, "other"),
    subcategory: safeNullableString(merged.subcategory),
    primary_color_hex: safeColor(merged.primary_color_hex),
    secondary_color_hex: safeColor(merged.secondary_color_hex),
    color_names: stringList(merged.color_names),
    pattern: safeNullableString(merged.pattern),
    silhouette: safeNullableString(merged.silhouette),
    materials: isObject(merged.materials) ? merged.materials : {},
    visible_text: stringList(merged.visible_text),
    season_tags: stringList(merged.season_tags),
    occasion_tags: stringList(merged.occasion_tags),
    notes: safeString(merged.notes),
  };
}

function normalizeBoundingBox(value: unknown): BoundingBox {
  const box = isObject(value) ? value : {};
  return {
    x: safeInteger(box.x, 0, 0, 999),
    y: safeInteger(box.y, 0, 0, 999),
    width: safeInteger(box.width, 1000, 1, 1000),
    height: safeInteger(box.height, 1000, 1, 1000),
  };
}

function normalizeCandidate(value: unknown, index: number): CandidateView | null {
  if (!isObject(value) || typeof value.id !== "string") return null;
  const status = candidateStatuses.has(value.status as CandidateStatus)
    ? (value.status as CandidateStatus)
    : "failed";
  const confidence = isObject(value.field_confidence)
    ? Object.fromEntries(
        Object.entries(value.field_confidence).filter(
          (entry): entry is [string, number] =>
            typeof entry[1] === "number" && entry[1] >= 0 && entry[1] <= 1,
        ),
      )
    : {};
  return {
    id: value.id,
    ordinal: safeInteger(value.ordinal, index, 0, 99),
    status,
    boundingBox: normalizeBoundingBox(value.bounding_box),
    metadata: normalizeMetadata(value.proposed_metadata, value.confirmed_metadata),
    fieldConfidence: confidence,
    cropUrl: safeSignedUrl(value.cropUrl),
    cutoutUrl: safeSignedUrl(value.cutoutUrl),
    failedCutoutUrl: safeSignedUrl(value.failedCutoutUrl),
    modeledUrl: safeSignedUrl(value.modeledUrl),
    errorMessage: safeNullableString(value.error_message),
    cleanupTolerance: safeInteger(value.cleanup_tolerance, 46, 18, 110),
  };
}

export function findResumableJob(jobs: ImportJobView[]) {
  return jobs.find((entry) => !["complete", "cancelled"].includes(entry.status));
}

export function resumableJobNeedsProcessing(job: ImportJobView) {
  return (
    ["queued", "analyzing", "extracting"].includes(job.status) ||
    job.candidates.some((candidate) => candidate.status === "extracting")
  );
}

export function validateImportFile(file: File): string | null {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return "Choose a JPG, PNG, or WebP image.";
  }
  if (!file.size || file.size > 20 * 1024 * 1024) {
    return "Choose an image smaller than 20 MB.";
  }
  return null;
}

export function normalizeJob(value: unknown): ImportJobView | null {
  if (!isObject(value) || typeof value.id !== "string") return null;
  const status = jobStatuses.has(value.status as JobStatus)
    ? (value.status as JobStatus)
    : "failed";
  const candidates = Array.isArray(value.import_job_candidates)
    ? value.import_job_candidates
        .map(normalizeCandidate)
        .filter((candidate): candidate is CandidateView => candidate !== null)
        .sort((a, b) => a.ordinal - b.ordinal)
    : [];
  return {
    id: value.id,
    status,
    progress: safeInteger(value.progress, 0, 0, 100),
    errorMessage: safeNullableString(value.error_message),
    originalImageUrl: safeSignedUrl(value.originalImageUrl),
    signedUrlExpiresIn: safeInteger(value.signedUrlExpiresIn, 600, 60, 7200),
    candidates,
  };
}

export function formFromMetadata(metadata: CandidateMetadata): MetadataForm {
  return {
    name: metadata.name,
    category: metadata.category,
    subcategory: metadata.subcategory ?? "",
    primaryColorHex: metadata.primary_color_hex ?? "",
    secondaryColorHex: metadata.secondary_color_hex ?? "",
    colorNames: metadata.color_names.join(", "),
    pattern: metadata.pattern ?? "",
    silhouette: metadata.silhouette ?? "",
    material: materialName(metadata.materials),
    visibleText: metadata.visible_text.join(", "),
    seasonTags: metadata.season_tags.join(", "),
    occasionTags: metadata.occasion_tags.join(", "),
    notes: metadata.notes,
  };
}

export function metadataFromForm(form: MetadataForm): CandidateMetadata {
  return {
    name: form.name.trim(),
    category: form.category,
    subcategory: form.subcategory.trim() || null,
    primary_color_hex: form.primaryColorHex || null,
    secondary_color_hex: form.secondaryColorHex || null,
    color_names: csv(form.colorNames).slice(0, 8),
    pattern: form.pattern.trim() || null,
    silhouette: form.silhouette.trim() || null,
    materials: form.material.trim() ? { apparent: form.material.trim(), inferred: true } : {},
    visible_text: csv(form.visibleText).slice(0, 12),
    season_tags: csv(form.seasonTags).slice(0, 8),
    occasion_tags: csv(form.occasionTags).slice(0, 12),
    notes: form.notes.trim(),
  };
}

export function createRegenerateCutout(
  job: ImportJobView | null,
  candidateAction: ReturnType<typeof createCandidateAction>,
) {
  return async function regenerate(
    candidate: CandidateView,
    instruction: string,
    tolerance: number,
  ) {
    if (!job) return;
    await candidateAction(
      candidate,
      () =>
        requestJson<unknown>(candidatePath(job.id, candidate.id, "/regenerate-cutout"), {
          method: "POST",
          body: JSON.stringify({
            instruction: instruction.trim() || null,
            cleanupTolerance: tolerance,
          }),
        }),
      true,
    );
  };
}

export async function uploadImportPhoto(
  file: File,
  userHint: string,
  onStageChange: (stage: UploadStage) => void,
) {
  onStageChange("signing");
  const signed = await requestJson<SignedUpload>("/api/uploads/sign", {
    method: "POST",
    body: JSON.stringify({
      purpose: "wardrobe-original",
      fileName: file.name || "camera-photo.jpg",
      contentType: file.type,
      fileSize: file.size,
    }),
  });
  if (file.size > signed.maximumFileSize || signed.requiredContentType !== file.type) {
    throw new Error("The selected file does not match the signed upload requirements.");
  }

  onStageChange("uploading");
  await uploadSignedFile(signed.signedUrl, file, signed.requiredContentType);

  onStageChange("creating");
  const idempotencyKey = crypto.randomUUID();
  const rawJob = await requestJson<unknown>("/api/imports", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({
      originalImagePath: signed.path,
      userHint: userHint.trim() || null,
      idempotencyKey,
    }),
  });
  const created = normalizeJob(rawJob);
  if (!created) throw new Error("The import job response was not valid.");
  return created;
}

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

export function useLocalPreview() {
  const localPreviewRef = useRef<string | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);

  const clearLocalPreview = useCallback(() => {
    if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current);
    localPreviewRef.current = null;
    setLocalPreviewUrl(null);
  }, []);

  useEffect(() => clearLocalPreview, [clearLocalPreview]);

  return { localPreviewRef, localPreviewUrl, setLocalPreviewUrl, clearLocalPreview };
}

export function useProcessFile(
  uploadLockRef: MutableRefObject<boolean>,
  localPreviewRef: MutableRefObject<string | null>,
  params: ProcessFileParams,
) {
  return useCallback(
    async (file: File) => {
      const { configured, loadingExisting, job, uploadStage, busyAction } = params;
      if (
        !configured ||
        loadingExisting ||
        job ||
        uploadStage !== "idle" ||
        busyAction ||
        uploadLockRef.current
      ) {
        return;
      }
      uploadLockRef.current = true;
      params.setError(null);
      const validationError = validateImportFile(file);
      if (validationError) {
        params.setError(validationError);
        uploadLockRef.current = false;
        return;
      }
      await runFileUpload({ file, localPreviewRef, ...params });
      uploadLockRef.current = false;
    },
    [localPreviewRef, params, uploadLockRef],
  );
}

function usePasteListener(configured: boolean, processFile: (file: File) => Promise<void>) {
  useEffect(() => {
    if (!configured) return;
    function paste(event: ClipboardEvent) {
      const file = Array.from(event.clipboardData?.files ?? []).find((entry) =>
        entry.type.startsWith("image/"),
      );
      if (file) void processFile(file);
    }
    window.addEventListener("paste", paste);
    return () => window.removeEventListener("paste", paste);
  }, [configured, processFile]);
}

function useClearPreviewOnJobImage({
  originalImageUrl,
  localPreviewRef,
  clearLocalPreview,
}: {
  originalImageUrl: string | null | undefined;
  localPreviewRef: MutableRefObject<string | null>;
  clearLocalPreview: () => void;
}) {
  useEffect(() => {
    if (originalImageUrl && localPreviewRef.current) clearLocalPreview();
  }, [clearLocalPreview, localPreviewRef, originalImageUrl]);
}

export function useImportWorkspaceUpload(
  configured: boolean,
  fields: ReturnType<typeof useImportWorkspaceFields>,
  startProcessing: (jobId: string) => void,
) {
  const { localPreviewRef, localPreviewUrl, setLocalPreviewUrl, clearLocalPreview } =
    useLocalPreview();

  useClearPreviewOnJobImage({
    originalImageUrl: fields.job?.originalImageUrl,
    localPreviewRef,
    clearLocalPreview,
  });

  const processFile = useProcessFile(fields.uploadLockRef, localPreviewRef, {
    configured,
    loadingExisting: fields.loadingExisting,
    job: fields.job,
    uploadStage: fields.uploadStage,
    busyAction: fields.busyAction,
    userHint: fields.userHint,
    clearLocalPreview,
    setLocalPreviewUrl,
    setDirtyCandidates: fields.setDirtyCandidates,
    setJob: fields.setJob,
    setUploadStage: fields.setUploadStage,
    setError: fields.setError,
    startProcessing,
  });
  usePasteListener(configured, processFile);

  return { localPreviewUrl, clearLocalPreview, processFile };
}

export function useLoadExistingJob({
  configured,
  setJob,
  setError,
  setLoadingExisting,
  startProcessing,
}: {
  configured: boolean;
  setJob: Dispatch<SetStateAction<ImportJobView | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setLoadingExisting: Dispatch<SetStateAction<boolean>>;
  startProcessing: (jobId: string) => void;
}) {
  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    void requestJson<unknown[]>("/api/imports")
      .then((rawJobs) => {
        if (cancelled) return;
        const jobs = rawJobs
          .map(normalizeJob)
          .filter((entry): entry is ImportJobView => entry !== null);
        const resumable = findResumableJob(jobs);
        if (resumable) {
          setJob(resumable);
          if (resumableJobNeedsProcessing(resumable)) startProcessing(resumable.id);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "Existing imports could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingExisting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [configured, setError, setJob, setLoadingExisting, startProcessing]);
}

export function usePollJob({
  job,
  refreshJob,
  setError,
}: {
  job: ImportJobView | null;
  refreshJob: (jobId: string) => Promise<ImportJobView>;
  setError: Dispatch<SetStateAction<string | null>>;
}) {
  useEffect(() => {
    if (!job || ["complete", "cancelled"].includes(job.status)) return;
    const activelyProcessing =
      ["queued", "analyzing", "extracting", "researching"].includes(job.status) ||
      job.candidates.some((candidate) => candidate.status === "extracting");
    const interval = window.setInterval(
      () => {
        void refreshJob(job.id).catch((caught: unknown) => {
          setError(
            caught instanceof Error ? caught.message : "Import progress could not be refreshed.",
          );
        });
      },
      activelyProcessing ? 1800 : Math.min(240_000, Math.max(60_000, job.signedUrlExpiresIn * 500)),
    );
    return () => window.clearInterval(interval);
  }, [job, refreshJob, setError]);
}

export function useStartProcessing({
  processingJobsRef,
  setUploadStage,
  setError,
  refreshJob,
}: {
  processingJobsRef: MutableRefObject<Set<string>>;
  setUploadStage: Dispatch<SetStateAction<UploadStage>>;
  setError: Dispatch<SetStateAction<string | null>>;
  refreshJob: (jobId: string) => Promise<ImportJobView>;
}) {
  return useCallback(
    (jobId: string) => {
      if (processingJobsRef.current.has(jobId)) return;
      processingJobsRef.current.add(jobId);
      setUploadStage("processing");
      void requestJson<unknown>(`/api/imports/${encodeURIComponent(jobId)}/process`, {
        method: "POST",
      })
        .then(() => refreshJob(jobId))
        .catch((caught: unknown) => {
          setError(
            caught instanceof Error
              ? caught.message
              : "Processing paused. Your import is saved and can be retried.",
          );
        })
        .finally(() => {
          processingJobsRef.current.delete(jobId);
          setUploadStage("idle");
        });
    },
    [processingJobsRef, refreshJob, setError, setUploadStage],
  );
}

function useRefreshJob(setJob: Dispatch<SetStateAction<ImportJobView | null>>) {
  return useCallback(
    async (jobId: string) => {
      const raw = await requestJson<unknown>(`/api/imports/${encodeURIComponent(jobId)}`);
      const next = normalizeJob(raw);
      if (!next) throw new Error("The import job response was not valid.");
      setJob(next);
      return next;
    },
    [setJob],
  );
}

function useImportWorkspaceProcessing(
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

// Best-effort nudge: a database trigger already durably queues a wardrobe
// compilation job whenever confirmed items land, so this call is purely a
// latency optimization to process it promptly. Safe to ignore if it fails.
function triggerWardrobeCompile() {
  fetch("/api/wardrobe/compile", { method: "POST" }).catch(() => {});
}

function useConfirmImport({
  job,
  setBusyAction,
  setError,
  refreshJob,
  setDirtyCandidates,
}: {
  job: ImportJobView | null;
  setBusyAction: Dispatch<SetStateAction<string | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  refreshJob: (jobId: string) => Promise<ImportJobView>;
  setDirtyCandidates: Dispatch<SetStateAction<Set<string>>>;
}) {
  return useCallback(async () => {
    if (!job) return;
    setBusyAction("confirm");
    setError(null);
    try {
      await requestJson<unknown>(`/api/imports/${encodeURIComponent(job.id)}/confirm`, {
        method: "POST",
      });
      triggerWardrobeCompile();
      await refreshJob(job.id);
      setDirtyCandidates(new Set());
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "The reviewed garments could not be saved.",
      );
    } finally {
      setBusyAction(null);
    }
  }, [job, refreshJob, setBusyAction, setDirtyCandidates, setError]);
}

function useCandidateActions({
  job,
  setBusyAction,
  setError,
  refreshJob,
  startProcessing,
  setDirtyCandidates,
}: {
  job: ImportJobView | null;
  setBusyAction: Dispatch<SetStateAction<string | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  refreshJob: (jobId: string) => Promise<ImportJobView>;
  startProcessing: (jobId: string) => void;
  setDirtyCandidates: Dispatch<SetStateAction<Set<string>>>;
}) {
  const candidateAction = createCandidateAction({
    job,
    setBusyAction,
    setError,
    refreshJob,
    startProcessing,
  });
  return {
    approveCrop: createApproveCrop(job, candidateAction),
    approveCutout: createApproveCutout(job, candidateAction),
    regenerate: createRegenerateCutout(job, candidateAction),
    saveMetadata: createSaveMetadata(job, candidateAction),
    rejectCandidate: createRejectCandidate(job, candidateAction, setDirtyCandidates),
  };
}

function useCancelImport({
  job,
  setBusyAction,
  setError,
  setJob,
  clearLocalPreview,
}: {
  job: ImportJobView | null;
  setBusyAction: Dispatch<SetStateAction<string | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setJob: Dispatch<SetStateAction<ImportJobView | null>>;
  clearLocalPreview: () => void;
}) {
  return useCallback(async () => {
    if (!job) return;
    if (!window.confirm("Cancel this import? No garments from it will be saved.")) return;
    setBusyAction("cancel");
    setError(null);
    try {
      const response = await fetch(`/api/imports/${encodeURIComponent(job.id)}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(errorMessage(payload, "The import could not be cancelled."));
      }
      setJob((current) => (current ? { ...current, status: "cancelled" } : null));
      clearLocalPreview();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The import could not be cancelled.");
    } finally {
      setBusyAction(null);
    }
  }, [clearLocalPreview, job, setBusyAction, setError, setJob]);
}

function useImportDerivedState(
  job: ImportJobView | null,
  dirtyCandidates: Set<string>,
  busyAction: string | null,
) {
  const currentStep = useMemo(() => {
    if (!job) return 1;
    if (["queued", "analyzing"].includes(job.status)) return 2;
    if (job.status === "complete") return 4;
    return 3;
  }, [job]);

  const canConfirm = Boolean(
    job &&
    job.status === "review_metadata" &&
    job.candidates.length > 0 &&
    job.candidates.every((candidate) =>
      ["review_metadata", "approved", "rejected"].includes(candidate.status),
    ) &&
    job.candidates.some((candidate) =>
      ["review_metadata", "approved"].includes(candidate.status),
    ) &&
    dirtyCandidates.size === 0 &&
    !busyAction,
  );

  const activeProcessing = Boolean(
    job &&
    (["queued", "analyzing", "extracting", "researching"].includes(job.status) ||
      job.candidates.some((candidate) => candidate.status === "extracting")),
  );

  return { currentStep, canConfirm, activeProcessing };
}

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
