import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getServerEnvironment } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processResearchRun } from "@/jobs/research-item";

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
  const { data, error } = await admin.rpc("claim_research_job", { p_lease_seconds: 300 });
  if (error) return NextResponse.json({ error: { code: "claim_failed" } }, { status: 500 });
  const claimed = Array.isArray(data) ? data[0] : data;
  const runId =
    typeof claimed === "string"
      ? claimed
      : claimed && typeof claimed === "object" && "id" in claimed
        ? claimed.id
        : null;
  if (typeof runId !== "string") return new NextResponse(null, { status: 204 });
  try {
    return NextResponse.json({ data: await processResearchRun(runId) }, { status: 202 });
  } catch {
    return NextResponse.json({ error: { code: "processing_failed" } }, { status: 500 });
  }
}
