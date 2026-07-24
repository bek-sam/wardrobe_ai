import { NextResponse } from "next/server";

import { updateImportCandidateSchema } from "@/features/intake/schemas/import-job";
import { parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/viewer";
import { createAdminClient } from "@/lib/supabase/admin";

import { handleSkipImportCandidate } from "./delete-handler";
import { handleUpdateImportCandidate } from "./patch-handler";

type Context = { params: Promise<{ jobId: string; candidateId: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const [{ jobId, candidateId }, viewer, input] = await Promise.all([
      context.params,
      requireViewer(),
      parseJson(request, updateImportCandidateSchema),
    ]);
    const admin = createAdminClient();
    const data = await handleUpdateImportCandidate(admin, viewer.id, jobId, candidateId, input);
    return NextResponse.json({ data });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const [{ jobId, candidateId }, viewer] = await Promise.all([context.params, requireViewer()]);
    const admin = createAdminClient();
    const data = await handleSkipImportCandidate(admin, viewer.id, jobId, candidateId);
    return NextResponse.json({ data });
  } catch (error) {
    return routeError(error);
  }
}
