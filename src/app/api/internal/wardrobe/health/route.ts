import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { getServerEnvironment } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const FAILED_WINDOW_HOURS = 24;

function authorized(request: Request, secret: string | undefined) {
  if (!secret) return false;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const expectedBytes = Buffer.from(secret);
  const suppliedBytes = Buffer.from(supplied);
  return (
    expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes)
  );
}

/**
 * Ops-facing aggregate status for the wardrobe-compilation worker: queue
 * depth by state, how long the oldest queued job has waited, and how many
 * jobs failed permanently in the last 24h. Deliberately returns only counts
 * and durations -- never job ids, user ids, or anything about a specific
 * user's wardrobe -- so it's safe to wire into an uptime/status dashboard.
 */
export async function GET(request: Request) {
  const environment = getServerEnvironment();
  const secret =
    environment.WARDROBE_COMPILATION_WORKER_SECRET ??
    environment.IMPORT_WORKER_SECRET ??
    environment.CRON_SECRET;
  if (!authorized(request, secret)) {
    return NextResponse.json(
      { error: { code: "not_authorized", message: "Worker authorization is required." } },
      { status: 401 },
    );
  }

  try {
    const admin = createAdminClient();
    const failedSinceIso = new Date(
      Date.now() - FAILED_WINDOW_HOURS * 60 * 60 * 1000,
    ).toISOString();

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

    const queued = queuedResult.count ?? 0;
    const running = runningResult.count ?? 0;
    const failed = failedResult.count ?? 0;
    const failedRecently = failedRecentlyResult.count ?? 0;
    const oldestQueuedAt = oldestQueuedResult.data?.created_at as string | undefined;
    const oldestQueuedAgeSeconds = oldestQueuedAt
      ? Math.max(0, Math.round((Date.now() - new Date(oldestQueuedAt).getTime()) / 1000))
      : null;

    return NextResponse.json(
      {
        data: {
          status: "ok" as const,
          queued_jobs: queued,
          running_jobs: running,
          failed_jobs: failed,
          failed_jobs_last_24h: failedRecently,
          oldest_queued_job_age_seconds: oldestQueuedAgeSeconds,
        },
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      { error: { code: "health_check_failed", message: "Wardrobe worker health check failed." } },
      { status: 500 },
    );
  }
}
