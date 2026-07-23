import type { CandidateStatus, JobStatus } from "./import-workspace.types";

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
