import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";

import type { updateImportCandidateSchema } from "@/features/intake/schemas/import-job";
import { ApiError } from "@/lib/api/response";

type UpdateImportCandidateInput = z.infer<typeof updateImportCandidateSchema>;

export async function handleUpdateImportCandidate(
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
