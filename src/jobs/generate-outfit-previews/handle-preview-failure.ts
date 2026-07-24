import { MissingCutoutError } from "./missing-cutout-error";
import { retryAt } from "./retry-at";
import type { AdminClient, OutfitPreviewJobRow } from "./types";

export async function handlePreviewFailure(
  admin: AdminClient,
  job: OutfitPreviewJobRow,
  error: unknown,
) {
  const isMissingCutout = error instanceof MissingCutoutError;
  console.error("Outfit preview generation failed", {
    jobId: job.id,
    candidateId: job.candidate_id,
    errorCode: isMissingCutout ? "missing_cutout" : "preview_generation_failed",
    message: error instanceof Error ? error.message : String(error),
  });
  try {
    await admin.rpc("fail_outfit_preview_job", {
      p_job_id: job.id,
      p_user_id: job.user_id,
      p_error_code: isMissingCutout ? "missing_cutout" : "preview_generation_failed",
      p_error_message: isMissingCutout
        ? "One or more items in this outfit has no approved cutout image yet."
        : "Modeled preview generation failed.",
      // A missing cutout will never resolve on its own -- don't burn the
      // retry budget on a job that can't succeed until the user re-imports
      // the item through the photo pipeline.
      p_next_attempt_at: isMissingCutout ? null : retryAt(job.attempt_count),
    });
  } catch {
    // Best-effort failure bookkeeping; never let this escape the caller.
  }
}
