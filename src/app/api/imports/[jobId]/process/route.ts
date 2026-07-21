import { NextResponse } from "next/server";
import { ApiError, routeError } from "@/lib/api/response";
import { requireViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { processImportJob } from "@/jobs/process-import";

export const runtime = "nodejs";
export const maxDuration = 300;

type Context = { params: Promise<{ jobId: string }> };

export async function POST(_request: Request, context: Context) {
  try {
    const [{ jobId }, viewer, supabase] = await Promise.all([
      context.params,
      requireViewer(),
      createClient(),
    ]);
    const { data: claimed, error: claimError } = await supabase.rpc("claim_owned_import_job", {
      p_job_id: jobId,
      p_lease_seconds: 300,
    });
    if (claimError) throw claimError;
    if (!Array.isArray(claimed) || !claimed[0]) {
      throw new ApiError(
        409,
        "job_not_claimable",
        "This import is already processing, not ready, or has exhausted its retry budget.",
      );
    }
    const result = await processImportJob(jobId, viewer.id);
    return NextResponse.json({ data: result }, { status: 202 });
  } catch (error) {
    return routeError(error);
  }
}
