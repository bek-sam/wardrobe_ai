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
