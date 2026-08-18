import { NextResponse } from "next/server";

import { routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { excludeTerminalJobStatuses } from "@/features/intake/server/job-primitives";
import { ApiError } from "@/lib/api/response";
import { withSignedImportUrls } from "@/features/intake/server/job-view";

async function handleGetImportJob(supabase: SupabaseClient, userId: string, jobId: string) {
  const { data, error } = await supabase
    .from("import_jobs")
    .select("*, import_job_candidates(*)")
    .eq("id", jobId)
    .eq("user_id", userId)
    .order("ordinal", { referencedTable: "import_job_candidates", ascending: true })
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError(404, "job_not_found", "Import job not found.");
  return withSignedImportUrls(supabase, data);
}

async function handleCancelImportJob(admin: SupabaseClient, userId: string, jobId: string) {
  const query = admin
    .from("import_jobs")
    .update({ status: "cancelled", completed_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("user_id", userId);
  const { data, error } = await excludeTerminalJobStatuses(query).select("id").maybeSingle();
  if (error) throw error;
  if (!data)
    throw new ApiError(409, "job_not_cancellable", "The import can no longer be cancelled.");
}

type Context = { params: Promise<{ jobId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const [{ jobId }, viewer, supabase] = await Promise.all([
      context.params,
      requireViewer(),
      createClient(),
    ]);
    const data = await handleGetImportJob(supabase, viewer.id, jobId);
    return NextResponse.json({ data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const [{ jobId }, viewer] = await Promise.all([context.params, requireViewer()]);
    const admin = createAdminClient();
    await handleCancelImportJob(admin, viewer.id, jobId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return routeError(error);
  }
}
