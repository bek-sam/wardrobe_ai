import { sweepFrequentCandidates } from "./sweep-frequent-candidates";
import { sweepSavedOutfits } from "./sweep-saved-outfits";
import { sweepTomorrowPlans } from "./sweep-tomorrow-plans";
import type { AdminClient, ServerEnvironment } from "./types";

/**
 * Best-effort daily sweep for preview priority rules 2-4 (user-saved
 * outfits, tomorrow's planned outfit, and frequently-suggested-without-a-
 * preview candidates). Idempotent on repeat calls: enqueue_outfit_preview_job
 * already dedupes/suppresses when a fresh preview exists or one is already
 * queued, so calling this at the top of every worker invocation needs no
 * separate daily cron of its own. Every step swallows its own errors so one
 * bad row never blocks the others or the worker's core claim/process loop.
 */
export async function enqueueScheduledPreviewJobs(
  admin: AdminClient,
  environment: ServerEnvironment,
) {
  await sweepTomorrowPlans(admin, environment);
  await sweepSavedOutfits(admin, environment);
  await sweepFrequentCandidates(admin, environment);
}
