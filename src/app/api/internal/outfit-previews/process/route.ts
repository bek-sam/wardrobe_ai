import { NextResponse } from "next/server";

import { authorizedWorkerRequest } from "@/app/api/_lib/worker-auth";
import { getServerEnvironment } from "@/lib/env/server";

import { runPreviewWorker } from "./run-preview-worker";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const environment = getServerEnvironment();
  const secret =
    environment.OUTFIT_PREVIEW_WORKER_SECRET ??
    environment.WARDROBE_COMPILATION_WORKER_SECRET ??
    environment.IMPORT_WORKER_SECRET ??
    environment.CRON_SECRET;
  if (!authorizedWorkerRequest(request, secret)) {
    return NextResponse.json(
      { error: { code: "not_authorized", message: "Worker authorization is required." } },
      { status: 401 },
    );
  }

  const result = await runPreviewWorker(environment);
  if (result.claimed === 0) return new NextResponse(null, { status: 204 });
  return NextResponse.json({ data: result }, { status: 202 });
}
