import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createImportJobSchema } from "@/features/intake/schemas/import-job";
import { withSignedImportUrls } from "@/features/intake/server/job-view";
import { ApiError, parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/viewer";
import { getServerEnvironment } from "@/lib/env/server";
import { assertOwnedStoragePath } from "@/lib/storage/private-images";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const viewer = await requireViewer();
    const supabase = await createClient();
    const url = new URL(request.url);
    const requestedStatus = url.searchParams.get("status");
    let query = supabase
      .from("import_jobs")
      .select("*, import_job_candidates(*)")
      .eq("user_id", viewer.id)
      .order("created_at", { ascending: false })
      .limit(30);
    if (requestedStatus) query = query.eq("status", requestedStatus);
    const { data, error } = await query;
    if (error) throw error;
    const jobs = await Promise.all((data ?? []).map((job) => withSignedImportUrls(supabase, job)));
    return NextResponse.json({ data: jobs }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const viewer = await requireViewer();
    const input = await parseJson(request, createImportJobSchema);
    assertOwnedStoragePath(input.originalImagePath, viewer.id);
    const environment = getServerEnvironment();
    const supabase = await createClient();
    const idempotencyKey =
      request.headers.get("Idempotency-Key") ?? input.idempotencyKey ?? randomUUID();
    if (idempotencyKey.length > 200) {
      throw new ApiError(400, "invalid_idempotency_key", "The idempotency key is too long.");
    }

    const requestHash = createHash("sha256")
      .update(`${viewer.id}:${input.originalImagePath}:${input.userHint ?? ""}`)
      .digest("hex");
    const { data, error } = await supabase.rpc("enqueue_import_job", {
      p_original_image_bucket: environment.WARDROBE_ORIGINALS_BUCKET,
      p_original_image_path: input.originalImagePath,
      p_idempotency_key: idempotencyKey,
      p_request_hash: requestHash,
      p_input_metadata: { userHint: input.userHint ?? null },
    });
    if (error?.code === "PT429") {
      throw new ApiError(
        429,
        "daily_import_limit_reached",
        "The daily photo-import limit is reached.",
      );
    }
    if (error?.code === "PT409") {
      throw new ApiError(
        409,
        "idempotency_key_payload_mismatch",
        "This retry key was already used for a different upload.",
      );
    }
    if (error?.code === "PT404") {
      throw new ApiError(
        422,
        "uploaded_image_not_found",
        "The private upload was not found. Upload the image again.",
      );
    }
    if (error?.code === "22023") {
      throw new ApiError(422, "invalid_import_request", "The import request is invalid.");
    }
    if (error || !data) throw error ?? new Error("Import job creation failed.");

    const replayed = Boolean(
      typeof data === "object" && data && "already_enqueued" in data && data.already_enqueued,
    );
    const job = await withSignedImportUrls(supabase, data);

    return NextResponse.json(
      { data: job },
      {
        status: replayed ? 200 : 202,
        headers: { Location: `/api/imports/${String(data.id)}` },
      },
    );
  } catch (error) {
    return routeError(error);
  }
}
