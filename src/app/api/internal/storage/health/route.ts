import { NextResponse } from "next/server";

import { authorizedWorkerRequest } from "@/app/api/_lib/worker-auth";
import { getServerEnvironment } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Ops-facing status for private-file deletion: queue depth, how long the
 * oldest pending object has waited, dead-lettered count, recent failures, and
 * how many account deletions are still waiting on Storage.
 *
 * The aggregation happens in `storage_deletion_health()` so this route cannot
 * accidentally select a row. Counts and durations only — never a user id, a
 * bucket name, an object path, or an error string. That is what makes it safe
 * to point an uptime dashboard at.
 *
 * Alert on: `dead_letter` above zero, `oldest_pending_age_seconds` growing
 * past a worker cycle (the scheduler has stopped), or
 * `account_deletions_needing_attention` above zero.
 */
export async function GET(request: Request) {
  const environment = getServerEnvironment();
  const secret = environment.IMPORT_WORKER_SECRET ?? environment.CRON_SECRET;
  if (!authorizedWorkerRequest(request, secret)) {
    return NextResponse.json(
      { error: { code: "not_authorized", message: "Worker authorization is required." } },
      { status: 401 },
    );
  }

  try {
    const { data, error } = await createAdminClient().rpc("storage_deletion_health");
    if (error) throw error;
    return NextResponse.json({ data }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(
      { error: { code: "health_check_failed", message: "Storage deletion health check failed." } },
      { status: 500 },
    );
  }
}
