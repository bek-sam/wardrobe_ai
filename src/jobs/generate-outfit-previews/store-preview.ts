import { randomUUID } from "node:crypto";

import { uploadPrivateObject } from "@/lib/storage/private-images";

import type { AdminClient, OutfitPreviewJobRow, ServerEnvironment } from "./types";

export async function storePreview(
  admin: AdminClient,
  environment: ServerEnvironment,
  job: OutfitPreviewJobRow,
  previewBytes: Buffer,
) {
  const path = `${job.user_id}/${job.candidate_id}/preview-${randomUUID()}.png`;
  await uploadPrivateObject(
    admin,
    environment.WARDROBE_GENERATED_BUCKET,
    path,
    job.user_id,
    previewBytes,
    "image/png",
  );
  await admin.rpc("finalize_outfit_preview_job", {
    p_job_id: job.id,
    p_user_id: job.user_id,
    p_bucket: environment.WARDROBE_GENERATED_BUCKET,
    p_storage_path: path,
    p_source_hash: job.source_hash,
    p_model: environment.OPENAI_IMAGE_MODEL ?? "unconfigured",
  });
}
