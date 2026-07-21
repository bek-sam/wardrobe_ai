import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getServerEnvironment } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processImportJob } from "@/jobs/process-import";

export const runtime = "nodejs";
export const maxDuration = 300;

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
  if (!authorized(request, environment.IMPORT_WORKER_SECRET ?? environment.CRON_SECRET)) {
    return NextResponse.json(
      { error: { code: "not_authorized", message: "Worker authorization is required." } },
      { status: 401 },
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_import_job", { p_lease_seconds: 300 });
  if (error) {
    return NextResponse.json(
      { error: { code: "claim_failed", message: "No job could be claimed." } },
      { status: 500 },
    );
  }
  const claimed = Array.isArray(data) ? data[0] : data;
  const jobId =
    typeof claimed === "string"
      ? claimed
      : claimed && typeof claimed === "object" && "id" in claimed
        ? claimed.id
        : null;
  if (typeof jobId !== "string") return new NextResponse(null, { status: 204 });

  try {
    const result = await processImportJob(jobId);
    return NextResponse.json({ data: result }, { status: 202 });
  } catch {
    return NextResponse.json(
      { error: { code: "processing_failed", message: "The claimed job failed safely." } },
      { status: 500 },
    );
  }
}
