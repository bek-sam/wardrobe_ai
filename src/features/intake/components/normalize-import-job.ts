import { isObject, safeNullableString } from "@/lib/api/normalize";

import { jobStatuses } from "./import-workspace-constants.data";
import { safeInteger, safeSignedUrl } from "./import-normalize-primitives";
import { normalizeCandidate } from "./normalize-import-candidate";
import type { CandidateView, ImportJobView, JobStatus } from "./import-workspace.types";

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
