import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { compileWardrobeForUser } from "@/jobs/compile-wardrobe";
import { getServerEnvironment } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 300;

// Stop claiming further work once we're this close to the platform's
// maxDuration, so an in-flight job's lease (300s, matching claim below)
// expires cleanly and a future invocation reclaims it, instead of the whole
// function being killed mid-write.
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
  const { data, error } = await admin.rpc("claim_wardrobe_compilation_jobs", {
    p_limit: 5,
    p_lease_seconds: 300,
  });
  if (error) {
    return NextResponse.json(
      { error: { code: "claim_failed", message: "No jobs could be claimed." } },
      { status: 500 },
    );
  }
  const jobs = (Array.isArray(data) ? data : data ? [data] : []) as {
    id: string;
    user_id: string;
  }[];
  if (jobs.length === 0) return new NextResponse(null, { status: 204 });

  let completed = 0;
  let failed = 0;
  let skipped = 0;
  for (const job of jobs) {
    if (Date.now() - startedAt > EXECUTION_BUDGET_MS) {
      // Leave the remaining claimed jobs' leases to expire naturally --
      // claim_wardrobe_compilation_jobs() only claims locked_until <= now(),
      // so the next invocation (or a concurrent worker) picks them back up.
      skipped = jobs.length - completed - failed;
      break;
    }
    try {
      await compileWardrobeForUser(job.user_id, job.id);
      completed += 1;
    } catch {
      failed += 1;
    }
  }

  return NextResponse.json(
    { data: { claimed: jobs.length, completed, failed, skipped } },
    { status: 202 },
  );
}
