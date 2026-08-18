import { NextResponse } from "next/server";

import { parseRouteParams } from "@/app/api/_lib/route";
import { routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { throwDatabaseError, throwNotFound } from "@/app/api/_lib/route";
import { ApiError } from "@/lib/api/response";
import { promoteConfirmedImportAssets } from "@/lib/imports/asset-promotion";
import { z } from "zod";

const importJobParamsSchema = z.object({ jobId: z.string().uuid() }).strict();

const confirmationResultSchema = z
  .object({
    job_id: z.string().uuid(),
    item_ids: z.array(z.string().uuid()).min(1),
    already_confirmed: z.boolean(),
  })
  .strict()
  .refine((value) => new Set(value.item_ids).size === value.item_ids.length, {
    message: "Confirmed item IDs must be unique.",
  });

async function confirmImportJob(supabase: SupabaseClient, jobId: string) {
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

async function handleConfirmImportJob(supabase: SupabaseClient, userId: string, jobId: string) {
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
