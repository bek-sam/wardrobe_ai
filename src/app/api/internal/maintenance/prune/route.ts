import { NextResponse } from "next/server";

import { authorizedWorkerRequest } from "@/app/api/_lib/worker-auth";
import { getServerEnvironment } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Scheduled retention sweep.
 *
 * Two separate concerns, deliberately run together so an operator has one job
 * to schedule: short-lived operational auth data (spent challenges, expired
 * rate-limit buckets, aged auth events) and finished account-deletion records.
 *
 * Neither prunes anything unfinished. A dead-lettered Storage object or a
 * deletion still flagged for attention is the only remaining evidence that
 * something needs repair, so both are explicitly excluded in SQL.
 */
export async function POST(request: Request) {
  const environment = getServerEnvironment();
  const secret = environment.IMPORT_WORKER_SECRET ?? environment.CRON_SECRET;
  if (!authorizedWorkerRequest(request, secret)) {
    return NextResponse.json(
      { error: { code: "not_authorized", message: "Worker authorization is required." } },
      { status: 401 },
    );
  }

  try {
    const admin = createAdminClient();
    const [operational, deletions] = await Promise.all([
      admin.rpc("prune_auth_operational_data", { p_event_retention_days: 90 }),
      admin.rpc("prune_completed_account_deletions", { p_retention_days: 30 }),
    ]);
    if (operational.error) throw operational.error;
    if (deletions.error) throw deletions.error;

    return NextResponse.json(
      { data: { ...operational.data, ...deletions.data } },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: { code: "prune_failed", message: "Retention sweep failed safely." } },
      { status: 500 },
    );
  }
}
