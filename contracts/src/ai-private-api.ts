import type { ServiceHealth } from "./service-health.js";

export const AI_PRIVATE_API_VERSION = "v1" as const;
export const AI_PRIVATE_API_PREFIX = `/internal/${AI_PRIVATE_API_VERSION}` as const;

export type AiTaskName =
  | "catalog-garments"
  | "occasion"
  | "classify-intent"
  | "curate-outfits"
  | "explain-variants"
  | "plan"
  | "product-research"
  | "select-outfit"
  | "explain-outfit"
  | "extract-garment"
  | "modeled-preview"
  | "visualization-generate"
  | "visualization-assess"
  | "visualization-localize"
  | "identity-assess";

export interface AiTaskRequest {
  input: unknown;
}

export interface AiTaskResponse<T = unknown> {
  data: T;
}

export interface AiTaskErrorResponse {
  error: {
    code:
      | "unauthorized"
      | "unknown_task"
      | "deadline_required"
      | "deadline_exceeded"
      | "invalid_task_input"
      | "ai_task_failed";
    message: string;
  };
}

export interface AiTaskMetadata {
  taskId: string;
  idempotencyKey: string;
  deadlineAt: string;
  policyVersion: string;
}

export interface AiTaskResultMetadata {
  taskId: string;
  providerRequestId: string | null;
  model: string;
  promptVersion: string;
  schemaVersion: string;
}

export type AiOrchestrationHealthResponse = ServiceHealth & { service: "ai-orchestration" };

// The transport envelope is generic, but there is deliberately no generic
// prompt task. Every accepted task name maps to one bounded implementation.
