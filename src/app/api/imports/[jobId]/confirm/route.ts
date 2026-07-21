import { NextResponse } from "next/server";
import { z } from "zod";

import { parseRouteParams, throwDatabaseError, throwNotFound } from "@/app/api/_lib/route";
import { ApiError, routeError } from "@/lib/api/response";
import { requireViewer } from "@/lib/auth/viewer";
import { promoteConfirmedImportAssets } from "@/lib/imports/asset-promotion";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ jobId: string }> };

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

export async function POST(_request: Request, context: Context) {
  try {
    const viewer = await requireViewer();
    const [{ jobId }, supabase] = await Promise.all([
      parseRouteParams(context.params, importJobParamsSchema),
      createClient(),
    ]);

    const { data: ownedJob, error: ownedJobError } = await supabase
      .from("import_jobs")
      .select("id")
      .eq("id", jobId)
      .eq("user_id", viewer.id)
      .maybeSingle();
    throwDatabaseError(ownedJobError, "Could not load the import job.");
    if (!ownedJob) throwNotFound("Import job");

    const { data, error } = await supabase.rpc("confirm_import_job", { p_job_id: jobId });
    if (error?.code === "55000" || error?.code === "23514") {
      throw new ApiError(
        409,
        "import_not_confirmable",
        "No reviewed candidates are ready to save.",
      );
    }
    throwDatabaseError(error, "Could not confirm the import job.");
    if (!data)
      throw new ApiError(
        409,
        "import_not_confirmable",
        "No reviewed candidates are ready to save.",
      );

    const parsedConfirmation = confirmationResultSchema.safeParse(data);
    if (!parsedConfirmation.success || parsedConfirmation.data.job_id !== jobId) {
      throw new ApiError(
        500,
        "invalid_import_confirmation",
        "The import confirmation returned an invalid result.",
      );
    }
    const confirmation = parsedConfirmation.data;

    try {
      await promoteConfirmedImportAssets({
        userId: viewer.id,
        jobId,
        itemIds: confirmation.item_ids,
      });
    } catch {
      throw new ApiError(
        503,
        "import_asset_promotion_failed",
        "Your items were saved, but their media could not be finalized. Retry confirmation.",
      );
    }

    return NextResponse.json(
      { data: confirmation },
      { status: confirmation.already_confirmed ? 200 : 201 },
    );
  } catch (error) {
    return routeError(error);
  }
}
