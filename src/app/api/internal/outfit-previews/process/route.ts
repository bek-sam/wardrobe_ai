import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import {
  enqueueScheduledPreviewJobs,
  processOutfitPreviewBatch,
} from "@/jobs/generate-outfit-previews";
import { getServerEnvironment } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 300;

// Stop claiming further work once we're this close to the platform's
// maxDuration, mirroring the wardrobe-compilation worker route.
const EXECUTION_BUDGET_MS = 260_000;

function authorized(request: Request, secret: string | undefined) {
  if (!secret) return false;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const expectedBytes = Buffer.from(secret);
  const suppliedBytes = Buffer.from(supplied);
  return (
    expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes)
  );
}

export async function POST(request: Request) {
  const environment = getServerEnvironment();
  const secret =
    environment.OUTFIT_PREVIEW_WORKER_SECRET ??
    environment.WARDROBE_COMPILATION_WORKER_SECRET ??
    environment.IMPORT_WORKER_SECRET ??
    environment.CRON_SECRET;
  if (!authorized(request, secret)) {
    return NextResponse.json(
      { error: { code: "not_authorized", message: "Worker authorization is required." } },
      { status: 401 },
    );
  }

  const startedAt = Date.now();
  const admin = createAdminClient();
  await enqueueScheduledPreviewJobs(admin, environment).catch(() => {
    // Scheduled-priority enqueue is best-effort; a failure here must never
    // block the core claim/process loop below.
  });

  let claimed = 0;
  let completed = 0;
  let failed = 0;
  let superseded = 0;
  while (Date.now() - startedAt < EXECUTION_BUDGET_MS) {
    const batch = await processOutfitPreviewBatch(10);
    claimed += batch.claimed;
    completed += batch.completed;
    failed += batch.failed;
    superseded += batch.superseded;
    if (batch.claimed === 0) break;
  }

  if (claimed === 0) return new NextResponse(null, { status: 204 });
  return NextResponse.json({ data: { claimed, completed, failed, superseded } }, { status: 202 });
}
