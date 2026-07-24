import { NextResponse } from "next/server";

import { getServerEnvironment } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";

import { authorized } from "./authorize";
import { fetchQueueStats } from "./fetch-queue-stats";

export const runtime = "nodejs";

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
    const data = await fetchQueueStats(admin);
    return NextResponse.json({ data }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: { code: "health_check_failed", message: "Wardrobe worker health check failed." } },
      { status: 500 },
    );
  }
}
