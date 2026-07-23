import { NextResponse } from "next/server";

import { outfitCandidateParamsSchema } from "@/app/api/_lib/schemas";
import { parseRouteParams, throwDatabaseError, throwNotFound } from "@/app/api/_lib/route";
import { ApiError, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/viewer";
import { processOwnedOutfitPreviewJob } from "@/jobs/generate-outfit-previews";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

type Context = { params: Promise<{ candidateId: string }> };

// Interactive counterpart to POST /api/internal/outfit-previews/process:
// claims and renders the caller's own just-enqueued preview job
// synchronously, mirroring /api/imports/[jobId]/process and
// /api/items/[itemId]/research/[runId]/process. Without this, a requested
// preview only ever reaches outfit_preview_jobs -- nothing but a
// secret-gated, scheduler-driven worker call can process it, so with no
// scheduler configured it would sit queued forever.
export async function POST(request: Request, context: Context) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const [{ candidateId }, viewer, supabase] = await Promise.all([
      parseRouteParams(context.params, outfitCandidateParamsSchema),
      requireViewer(),
      createClient(),
    ]);
    const { data: claimed, error: claimError } = await supabase.rpc(
      "claim_owned_outfit_preview_job",
      { p_candidate_id: candidateId, p_lease_seconds: 300 },
    );
    if (claimError) throw claimError;
    if (!Array.isArray(claimed) || !claimed[0]) {
      throw new ApiError(
        409,
        "preview_not_claimable",
        "This preview is already processing, not queued, or has exhausted its retry budget.",
      );
    }

    await processOwnedOutfitPreviewJob(claimed[0].id as string, viewer.id);

    const { data: candidate, error: candidateError } = await supabase
      .from("outfit_candidates")
      .select("preview_status")
      .eq("id", candidateId)
      .eq("user_id", viewer.id)
      .maybeSingle();
    throwDatabaseError(candidateError, "Could not load the outfit candidate.");
    if (!candidate) throwNotFound("Outfit candidate");

    return NextResponse.json({ data: { status: candidate.preview_status } }, { status: 202 });
  } catch (error) {
    return routeError(error);
  }
}
