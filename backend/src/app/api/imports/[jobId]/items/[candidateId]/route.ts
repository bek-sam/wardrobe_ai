import { NextResponse } from "next/server";

import { updateImportCandidateSchema } from "@/features/intake/schemas/import-job";
import { parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import { ApiError } from "@/lib/api/response";

async function advanceJobIfAllReviewed(admin: SupabaseClient, userId: string, jobId: string) {
  const { data: candidates, error } = await admin
    .from("import_job_candidates")
    .select("status")
    .eq("job_id", jobId)
    .eq("user_id", userId);
  if (error) throw error;

  const statuses = (candidates ?? []).map((candidate) => candidate.status as string);
  const allReviewed =
    statuses.length > 0 &&
    statuses.every((status) => ["review_metadata", "approved", "rejected"].includes(status));
  if (!allReviewed) return;

  await admin
    .from("import_jobs")
    .update({ status: "review_metadata", progress: 70 })
    .eq("id", jobId)
    .eq("user_id", userId)
    .not("status", "in", "(complete,cancelled)");
}

async function handleSkipImportCandidate(
  admin: SupabaseClient,
  userId: string,
  jobId: string,
  candidateId: string,
) {
  const { data, error } = await admin
    .from("import_job_candidates")
    .update({ status: "rejected", error_code: null, error_message: null })
    .eq("id", candidateId)
    .eq("job_id", jobId)
    .eq("user_id", userId)
    .in("status", ["review_crop", "review_cutout", "review_metadata", "failed"])
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new ApiError(409, "candidate_not_rejectable", "This candidate can no longer be skipped.");
  }

  await advanceJobIfAllReviewed(admin, userId, jobId);
  return data;
}

type UpdateImportCandidateInput = z.infer<typeof updateImportCandidateSchema>;

async function handleUpdateImportCandidate(
  admin: SupabaseClient,
  userId: string,
  jobId: string,
  candidateId: string,
  input: UpdateImportCandidateInput,
) {
  const { data: current, error: readError } = await admin
    .from("import_job_candidates")
    .select("confirmed_metadata, bounding_box, status")
    .eq("id", candidateId)
    .eq("job_id", jobId)
    .eq("user_id", userId)
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
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

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
