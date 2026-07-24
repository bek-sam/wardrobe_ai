import { NextResponse } from "next/server";

import { authorizedWorkerRequest } from "@/app/api/_lib/worker-auth";
import { getServerEnvironment } from "@/lib/env/server";

import { claimAndProcessJobs } from "./claim-and-process-jobs";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const environment = getServerEnvironment();
  const secret =
    environment.WARDROBE_COMPILATION_WORKER_SECRET ??
    environment.IMPORT_WORKER_SECRET ??
    environment.CRON_SECRET;
  if (!authorizedWorkerRequest(request, secret)) {
    return NextResponse.json(
      { error: { code: "not_authorized", message: "Worker authorization is required." } },
      { status: 401 },
    );
  }

  const result = await claimAndProcessJobs();
  if (!result) {
    return NextResponse.json(
      { error: { code: "claim_failed", message: "No jobs could be claimed." } },
      { status: 500 },
    );
  }
  if (result.claimed === 0) return new NextResponse(null, { status: 204 });

  return NextResponse.json({ data: result }, { status: 202 });
}
