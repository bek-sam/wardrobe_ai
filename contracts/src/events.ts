export const JOB_TYPES = [
  "import.requested",
  "research.requested",
  "wardrobe-compilation.requested",
  "outfit-preview.requested",
  "outfit-visualization.requested",
  "storage-deletion.requested",
] as const;

export type JobType = (typeof JOB_TYPES)[number];

export interface JobMessageV1 {
  specVersion: "1.0";
  id: string;
  type: JobType;
  occurredAt: string;
  correlationId: string;
  idempotencyKey: string;
  data: {
    jobId: string;
  };
}

export interface WorkerOutcome {
  jobId: string;
  outcome: "succeeded" | "retry" | "terminal_failure";
  retryAt?: string;
  errorCode?: string;
}
