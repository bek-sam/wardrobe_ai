import type { SupabaseClient } from "@supabase/supabase-js";

import { throwDatabaseError } from "@/app/api/_lib/route";
import { ApiError } from "@/lib/api/response";

import { confirmationResultSchema } from "./schema";

export async function confirmImportJob(supabase: SupabaseClient, jobId: string) {
  const { data, error } = await supabase.rpc("confirm_import_job", { p_job_id: jobId });
  if (error?.code === "55000" || error?.code === "23514") {
    throw new ApiError(409, "import_not_confirmable", "No reviewed candidates are ready to save.");
  }
  throwDatabaseError(error, "Could not confirm the import job.");
  if (!data) {
    throw new ApiError(409, "import_not_confirmable", "No reviewed candidates are ready to save.");
  }

  const parsedConfirmation = confirmationResultSchema.safeParse(data);
  if (!parsedConfirmation.success || parsedConfirmation.data.job_id !== jobId) {
    throw new ApiError(
      500,
      "invalid_import_confirmation",
      "The import confirmation returned an invalid result.",
    );
  }
  return parsedConfirmation.data;
}
