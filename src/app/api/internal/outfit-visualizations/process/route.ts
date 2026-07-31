import { NextResponse } from "next/server";

import { authorizedWorkerRequest } from "@/app/api/_lib/worker-auth";
import { getServerEnvironment } from "@/lib/env/server";
import { processVisualizationBatch } from "@/jobs/generate-outfit-visualizations";

export const runtime = "nodejs";
export const maxDuration = 300;

// Stop claiming further work this close to the platform's maxDuration.
const EXECUTION_BUDGET_MS = 250_000;

/**
 * The production path: a scheduler calls this with the worker secret. Nothing
 * in the interactive request lifecycle waits on it.
 */
export async function POST(request: Request) {
  const environment = getServerEnvironment();
  const secret =
    environment.OUTFIT_VISUALIZATION_WORKER_SECRET ??
    environment.OUTFIT_PREVIEW_WORKER_SECRET ??
    environment.IMPORT_WORKER_SECRET ??
    environment.CRON_SECRET;
  if (!authorizedWorkerRequest(request, secret)) {
    return NextResponse.json(
      { error: { code: "not_authorized", message: "Worker authorization is required." } },
      { status: 401 },
    );
  }

  const startedAt = Date.now();
  let totals = { claimed: 0, completed: 0, failed: 0, superseded: 0, skipped: 0 };
  while (Date.now() - startedAt < EXECUTION_BUDGET_MS) {
    const batch = await processVisualizationBatch(startedAt, EXECUTION_BUDGET_MS);
    totals = {
      claimed: totals.claimed + batch.claimed,
      completed: totals.completed + batch.completed,
      failed: totals.failed + batch.failed,
      superseded: totals.superseded + batch.superseded,
      skipped: totals.skipped + batch.skipped,
    };
    if (batch.claimed === 0 || batch.skipped > 0) break;
  }

  if (totals.claimed === 0) return new NextResponse(null, { status: 204 });
  return NextResponse.json({ data: totals }, { status: 202 });
}
