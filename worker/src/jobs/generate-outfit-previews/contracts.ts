import { getServerEnvironment } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type AdminClient = ReturnType<typeof createAdminClient>;
export type ServerEnvironment = ReturnType<typeof getServerEnvironment>;

export type OutfitPreviewJobRow = {
  id: string;
  user_id: string;
  candidate_id: string;
  source_hash: string;
  attempt_count: number;
};

export type CandidateMemberRow = { item_id: string; role: string; sort_order: number };
export type PreviewJobOutcome = "completed" | "failed" | "superseded";

// A missing cutout cannot be healed by retrying the same job. Keeping this
// distinguished error beside the job contracts lets every pipeline step share
// the classification without importing the worker entrypoint.
export class MissingCutoutError extends Error {
  constructor(readonly itemId: string) {
    super(`No cutout image found for item ${itemId}.`);
    this.name = "MissingCutoutError";
  }
}

export function retryAt(attemptCount: number) {
  const delaySeconds = Math.min(60 * 60, 30 * 2 ** Math.max(0, attemptCount - 1));
  return new Date(Date.now() + delaySeconds * 1_000).toISOString();
}
