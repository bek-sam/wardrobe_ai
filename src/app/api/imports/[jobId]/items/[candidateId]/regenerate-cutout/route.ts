import { NextResponse } from "next/server";

import { regenerateCutoutSchema } from "@/features/intake/schemas/import-job";
import { parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

import { handleRegenerateCutout } from "./handler";

type Context = { params: Promise<{ jobId: string; candidateId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const [{ jobId, candidateId }, viewer, input, supabase] = await Promise.all([
      context.params,
      requireViewer(),
      parseJson(request, regenerateCutoutSchema),
      createClient(),
    ]);

    const data = await handleRegenerateCutout(supabase, viewer.id, jobId, candidateId, input);
    return NextResponse.json({ data }, { status: 202 });
  } catch (error) {
    return routeError(error);
  }
}
