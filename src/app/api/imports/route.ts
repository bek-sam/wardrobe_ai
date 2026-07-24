import { NextResponse } from "next/server";

import { createImportJobSchema } from "@/features/intake/schemas/import-job";
import { parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

import { handleListImportJobs } from "./get-handler";
import { handleCreateImportJob } from "./post-handler";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const viewer = await requireViewer();
    const supabase = await createClient();
    const url = new URL(request.url);
    const requestedStatus = url.searchParams.get("status");
    const jobs = await handleListImportJobs(supabase, viewer.id, requestedStatus);
    return NextResponse.json({ data: jobs }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const viewer = await requireViewer();
    const input = await parseJson(request, createImportJobSchema);
    const supabase = await createClient();

    const { job, replayed, jobId } = await handleCreateImportJob(
      supabase,
      viewer.id,
      input,
      request.headers.get("Idempotency-Key"),
    );

    return NextResponse.json(
      { data: job },
      { status: replayed ? 200 : 202, headers: { Location: `/api/imports/${jobId}` } },
    );
  } catch (error) {
    return routeError(error);
  }
}
