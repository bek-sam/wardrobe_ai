import { discardUnpublishedVersion } from "./discard-unpublished-version";
import { retryAt } from "./retry-at";
import type { AdminClient, WardrobeCompilationJobRow } from "./types";

export async function handleCompilationFailure(
  admin: AdminClient,
  job: WardrobeCompilationJobRow,
  compiledWardrobeVersion: string,
  isNewVersion: boolean,
  error: unknown,
) {
  const message = error instanceof Error ? error.message : "Unknown wardrobe compilation error";
  if (isNewVersion) {
    await discardUnpublishedVersion(admin, job.user_id, compiledWardrobeVersion);
  }
  await admin
    .from("wardrobe_compilation_jobs")
    .update({
      status: "failed",
      error_code: "compilation_failed",
      error_message: message,
      locked_at: null,
      locked_until: null,
      next_attempt_at: retryAt(job.attempt_count),
    })
    .eq("id", job.id)
    .eq("user_id", job.user_id);
}
