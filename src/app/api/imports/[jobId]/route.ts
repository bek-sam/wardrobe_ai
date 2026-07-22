import { NextResponse } from "next/server";
import { withSignedImportUrls } from "@/features/intake/server/job-view";
import { ApiError, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/viewer";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ jobId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const [{ jobId }, viewer, supabase] = await Promise.all([
      context.params,
      requireViewer(),
      createClient(),
    ]);
    const { data, error } = await supabase
      .from("import_jobs")
      .select("*, import_job_candidates(*)")
      .eq("id", jobId)
      .eq("user_id", viewer.id)
      .order("ordinal", { referencedTable: "import_job_candidates", ascending: true })
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError(404, "job_not_found", "Import job not found.");
    return NextResponse.json(
      { data: await withSignedImportUrls(supabase, data) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
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
    const { data, error } = await admin
      .from("import_jobs")
      .update({ status: "cancelled", completed_at: new Date().toISOString() })
      .eq("id", jobId)
      .eq("user_id", viewer.id)
      .not("status", "in", "(complete,cancelled)")
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data)
      throw new ApiError(409, "job_not_cancellable", "The import can no longer be cancelled.");
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return routeError(error);
  }
}
