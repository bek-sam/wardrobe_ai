import type { ImportJobView } from "./import-workspace.types";

export function findResumableJob(jobs: ImportJobView[]) {
  return jobs.find((entry) => !["complete", "cancelled"].includes(entry.status));
}

export function resumableJobNeedsProcessing(job: ImportJobView) {
  return (
    ["queued", "analyzing", "extracting"].includes(job.status) ||
    job.candidates.some((candidate) => candidate.status === "extracting")
  );
}
