import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { ApiError } from "@/lib/api/response";
import type { ServerEnvironment } from "@/lib/env/server";

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

export async function enqueueImportJob(
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
