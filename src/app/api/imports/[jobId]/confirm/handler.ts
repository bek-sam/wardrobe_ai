import type { SupabaseClient } from "@supabase/supabase-js";

import { throwDatabaseError, throwNotFound } from "@/app/api/_lib/route";
import { ApiError } from "@/lib/api/response";
import { promoteConfirmedImportAssets } from "@/lib/imports/asset-promotion";

import { confirmImportJob } from "./confirm-job";

export async function handleConfirmImportJob(
  supabase: SupabaseClient,
  userId: string,
  jobId: string,
) {
  const { data: ownedJob, error: ownedJobError } = await supabase
    .from("import_jobs")
    .select("id")
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle();
  throwDatabaseError(ownedJobError, "Could not load the import job.");
  if (!ownedJob) throwNotFound("Import job");

  const confirmation = await confirmImportJob(supabase, jobId);

  try {
    await promoteConfirmedImportAssets({ userId, jobId, itemIds: confirmation.item_ids });
  } catch {
    throw new ApiError(
      503,
      "import_asset_promotion_failed",
      "Your items were saved, but their media could not be finalized. Retry confirmation.",
    );
  }

  return confirmation;
}
