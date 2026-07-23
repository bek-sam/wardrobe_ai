export function candidatePath(jobId: string, candidateId: string, suffix = "") {
  return `/api/imports/${encodeURIComponent(jobId)}/items/${encodeURIComponent(candidateId)}${suffix}`;
}
