import { NextResponse } from "next/server";
import { updateImportCandidateSchema } from "@/features/intake/schemas/import-job";
import { ApiError, parseJson, routeError } from "@/lib/api/response";
import { requireViewer } from "@/lib/auth/viewer";
import { createAdminClient } from "@/lib/supabase/admin";

type Context = { params: Promise<{ jobId: string; candidateId: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    const [{ jobId, candidateId }, viewer, input] = await Promise.all([
      context.params,
      requireViewer(),
      parseJson(request, updateImportCandidateSchema),
    ]);
    const admin = createAdminClient();
    const { data: current, error: readError } = await admin
      .from("import_job_candidates")
      .select("confirmed_metadata, bounding_box, status")
      .eq("id", candidateId)
      .eq("job_id", jobId)
      .eq("user_id", viewer.id)
      .maybeSingle();
    if (readError) throw readError;
    if (!current) throw new ApiError(404, "candidate_not_found", "Import candidate not found.");
    if (["approved", "rejected"].includes(current.status)) {
      throw new ApiError(409, "candidate_locked", "This candidate can no longer be edited.");
    }
    const { data, error } = await admin
      .from("import_job_candidates")
      .update({
        confirmed_metadata: input.metadata
          ? { ...(current.confirmed_metadata ?? {}), ...input.metadata }
          : current.confirmed_metadata,
        bounding_box: input.boundingBox ?? current.bounding_box,
      })
      .eq("id", candidateId)
      .eq("job_id", jobId)
      .eq("user_id", viewer.id)
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const [{ jobId, candidateId }, viewer] = await Promise.all([context.params, requireViewer()]);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("import_job_candidates")
      .update({ status: "rejected", error_code: null, error_message: null })
      .eq("id", candidateId)
      .eq("job_id", jobId)
      .eq("user_id", viewer.id)
      .in("status", ["review_crop", "review_cutout", "review_metadata", "failed"])
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      throw new ApiError(
        409,
        "candidate_not_rejectable",
        "This candidate can no longer be skipped.",
      );
    }

    const { data: candidates, error: candidatesError } = await admin
      .from("import_job_candidates")
      .select("status")
      .eq("job_id", jobId)
      .eq("user_id", viewer.id);
    if (candidatesError) throw candidatesError;
    const statuses = (candidates ?? []).map((candidate) => candidate.status as string);
    if (
      statuses.length > 0 &&
      statuses.every((status) => ["review_metadata", "approved", "rejected"].includes(status))
    ) {
      await admin
        .from("import_jobs")
        .update({ status: "review_metadata", progress: 70 })
        .eq("id", jobId)
        .eq("user_id", viewer.id)
        .not("status", "in", "(complete,cancelled)");
    }
    return NextResponse.json({ data });
  } catch (error) {
    return routeError(error);
  }
}
