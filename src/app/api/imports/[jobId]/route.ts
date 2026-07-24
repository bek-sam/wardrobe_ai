import { NextResponse } from "next/server";

import { routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/viewer";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { handleCancelImportJob } from "./delete-handler";
import { handleGetImportJob } from "./get-handler";

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
