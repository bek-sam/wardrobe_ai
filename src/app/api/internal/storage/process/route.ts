import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { processStorageDeletionBatch } from "@/jobs/process-storage-deletions";
import { getServerEnvironment } from "@/lib/env/server";

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

  try {
    const result = await processStorageDeletionBatch();
    return result.claimed === 0
      ? new NextResponse(null, { status: 204 })
      : NextResponse.json({ data: result }, { status: 202 });
  } catch {
    return NextResponse.json(
      { error: { code: "processing_failed", message: "Storage cleanup failed safely." } },
      { status: 500 },
    );
  }
}
