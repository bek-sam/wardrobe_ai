import type { SupabaseClient } from "@supabase/supabase-js";

const FAILED_WINDOW_HOURS = 24;

export async function fetchQueueStats(admin: SupabaseClient) {
  const failedSinceIso = new Date(Date.now() - FAILED_WINDOW_HOURS * 60 * 60 * 1000).toISOString();

  const [queuedResult, runningResult, failedResult, failedRecentlyResult, oldestQueuedResult] =
    await Promise.all([
      admin
        .from("wardrobe_compilation_jobs")
        .select("*", { count: "exact", head: true })
        .eq("status", "queued"),
      admin
        .from("wardrobe_compilation_jobs")
        .select("*", { count: "exact", head: true })
        .eq("status", "running"),
      admin
        .from("wardrobe_compilation_jobs")
        .select("*", { count: "exact", head: true })
        .eq("status", "failed"),
      admin
        .from("wardrobe_compilation_jobs")
        .select("*", { count: "exact", head: true })
        .eq("status", "failed")
        .gte("updated_at", failedSinceIso),
      admin
        .from("wardrobe_compilation_jobs")
        .select("created_at")
        .eq("status", "queued")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);
  if (queuedResult.error) throw queuedResult.error;
  if (runningResult.error) throw runningResult.error;
  if (failedResult.error) throw failedResult.error;
  if (failedRecentlyResult.error) throw failedRecentlyResult.error;
  if (oldestQueuedResult.error) throw oldestQueuedResult.error;

  const oldestQueuedAt = oldestQueuedResult.data?.created_at as string | undefined;
  const oldestQueuedAgeSeconds = oldestQueuedAt
    ? Math.max(0, Math.round((Date.now() - new Date(oldestQueuedAt).getTime()) / 1000))
    : null;

  return {
    status: "ok" as const,
    queued_jobs: queuedResult.count ?? 0,
    running_jobs: runningResult.count ?? 0,
    failed_jobs: failedResult.count ?? 0,
    failed_jobs_last_24h: failedRecentlyResult.count ?? 0,
    oldest_queued_job_age_seconds: oldestQueuedAgeSeconds,
  };
}
