import { NextResponse } from "next/server";

import { createImportJobSchema } from "@/features/intake/schemas/import-job";
import { parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api/response";
import type { ServerEnvironment } from "@/lib/env/server";
import { withSignedImportUrls } from "@/features/intake/server/job-view";
import { randomUUID } from "node:crypto";
import type { z } from "zod";
import { getServerEnvironment } from "@/lib/env/server";
import { assertOwnedStoragePath } from "@/lib/storage/private-images";

const ENQUEUE_ERROR_MESSAGES: Record<string, { status: number; code: string; message: string }> = {
  PT429: {
    status: 429,
    code: "daily_import_limit_reached",
    message: "The daily photo-import limit is reached.",
  },
  PT409: {
    status: 409,
    code: "idempotency_key_payload_mismatch",
    message: "This retry key was already used for a different upload.",
  },
  PT404: {
    status: 422,
    code: "uploaded_image_not_found",
    message: "The private upload was not found. Upload the image again.",
  },
  "22023": {
    status: 422,
    code: "invalid_import_request",
    message: "The import request is invalid.",
  },
};

async function enqueueImportJob(
  supabase: SupabaseClient,
  environment: ServerEnvironment,
  userId: string,
  originalImagePath: string,
  userHint: string | null | undefined,
  idempotencyKey: string,
) {
  const requestHash = createHash("sha256")
    .update(`${userId}:${originalImagePath}:${userHint ?? ""}`)
    .digest("hex");
  const { data, error } = await supabase.rpc("enqueue_import_job", {
    p_original_image_bucket: environment.WARDROBE_ORIGINALS_BUCKET,
    p_original_image_path: originalImagePath,
    p_idempotency_key: idempotencyKey,
    p_request_hash: requestHash,
    p_input_metadata: { userHint: userHint ?? null },
  });
  const mapped = error ? ENQUEUE_ERROR_MESSAGES[error.code] : undefined;
  if (mapped) throw new ApiError(mapped.status, mapped.code, mapped.message);
  if (error || !data) throw error ?? new Error("Import job creation failed.");
  return data;
}

async function handleListImportJobs(
  supabase: SupabaseClient,
  userId: string,
  requestedStatus: string | null,
) {
  let query = supabase
    .from("import_jobs")
    .select("*, import_job_candidates(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (requestedStatus) query = query.eq("status", requestedStatus);
  const { data, error } = await query;
  if (error) throw error;
  return Promise.all((data ?? []).map((job) => withSignedImportUrls(supabase, job)));
}

function resolveIdempotencyKey(headerValue: string | null, bodyKey: string | undefined) {
  const idempotencyKey = headerValue ?? bodyKey ?? randomUUID();
  if (idempotencyKey.length > 200) {
    throw new ApiError(400, "invalid_idempotency_key", "The idempotency key is too long.");
  }
  return idempotencyKey;
}

type CreateImportJobInput = z.infer<typeof createImportJobSchema>;

async function handleCreateImportJob(
  supabase: SupabaseClient,
  userId: string,
  input: CreateImportJobInput,
  idempotencyKeyHeader: string | null,
) {
  assertOwnedStoragePath(input.originalImagePath, userId);
  const environment = getServerEnvironment();
  const idempotencyKey = resolveIdempotencyKey(idempotencyKeyHeader, input.idempotencyKey);

  const data = await enqueueImportJob(
    supabase,
    environment,
    userId,
    input.originalImagePath,
    input.userHint,
    idempotencyKey,
  );

  const replayed = Boolean(
    typeof data === "object" && data && "already_enqueued" in data && data.already_enqueued,
  );
  const job = await withSignedImportUrls(supabase, data);

  return { job, replayed, jobId: String(data.id) };
}

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const viewer = await requireViewer();
    const supabase = await createClient();
    const url = new URL(request.url);
    const requestedStatus = url.searchParams.get("status");
    const jobs = await handleListImportJobs(supabase, viewer.id, requestedStatus);
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
    const supabase = await createClient();

    const { job, replayed, jobId } = await handleCreateImportJob(
      supabase,
      viewer.id,
      input,
      request.headers.get("Idempotency-Key"),
    );

    return NextResponse.json(
      { data: job },
      { status: replayed ? 200 : 202, headers: { Location: `/api/imports/${jobId}` } },
    );
  } catch (error) {
    return routeError(error);
  }
}
