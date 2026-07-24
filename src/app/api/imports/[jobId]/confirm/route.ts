import { NextResponse } from "next/server";

import { parseRouteParams } from "@/app/api/_lib/route";
import { routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

import { handleConfirmImportJob } from "./handler";
import { importJobParamsSchema } from "./schema";

type Context = { params: Promise<{ jobId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const viewer = await requireViewer();
    const [{ jobId }, supabase] = await Promise.all([
      parseRouteParams(context.params, importJobParamsSchema),
      createClient(),
    ]);

    const confirmation = await handleConfirmImportJob(supabase, viewer.id, jobId);
    return NextResponse.json(
      { data: confirmation },
      { status: confirmation.already_confirmed ? 200 : 201 },
    );
  } catch (error) {
    return routeError(error);
  }
}
