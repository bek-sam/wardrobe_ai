import { NextResponse } from "next/server";

import { requireOwnedImportJob } from "@/features/intake/server/job-primitives";
import { ApiError, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ jobId: string }> };

/** Compatibility command: durable execution is exclusively owned by Worker. */
export async function POST(request: Request, context: Context) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const [{ jobId }, viewer, supabase] = await Promise.all([
      context.params,
      requireViewer(),
      createClient(),
    ]);
    const job = await requireOwnedImportJob(supabase, viewer.id, jobId);
    if (!job) throw new ApiError(404, "job_not_found", "Import job not found.");
    return NextResponse.json({ data: { jobId, status: job.status } }, { status: 202 });
  } catch (error) {
    return routeError(error);
  }
}
