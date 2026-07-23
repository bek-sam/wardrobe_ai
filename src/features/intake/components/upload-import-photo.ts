import { requestJson } from "@/lib/api/request";
import { createClient } from "@/lib/supabase/client";

import { normalizeJob } from "./normalize-import-job";
import type { SignedUpload, UploadStage } from "./import-workspace.types";

export async function uploadImportPhoto(
  file: File,
  userHint: string,
  onStageChange: (stage: UploadStage) => void,
) {
  onStageChange("signing");
  const signed = await requestJson<SignedUpload>("/api/uploads/sign", {
    method: "POST",
    body: JSON.stringify({
      purpose: "wardrobe-original",
      fileName: file.name || "camera-photo.jpg",
      contentType: file.type,
      fileSize: file.size,
    }),
  });
  if (file.size > signed.maximumFileSize || signed.requiredContentType !== file.type) {
    throw new Error("The selected file does not match the signed upload requirements.");
  }

  onStageChange("uploading");
  const supabase = createClient();
  const { error: uploadError } = await supabase.storage
    .from(signed.bucket)
    .uploadToSignedUrl(signed.path, signed.token, file, {
      contentType: signed.requiredContentType,
    });
  if (uploadError) throw new Error("The private image upload failed. Please try again.");

  onStageChange("creating");
  const idempotencyKey = crypto.randomUUID();
  const rawJob = await requestJson<unknown>("/api/imports", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({
      originalImagePath: signed.path,
      userHint: userHint.trim() || null,
      idempotencyKey,
    }),
  });
  const created = normalizeJob(rawJob);
  if (!created) throw new Error("The import job response was not valid.");
  return created;
}
