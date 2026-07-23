import { requestJson } from "@/lib/api/request";
import { createClient } from "@/lib/supabase/client";

import type { Profile, SignedUpload } from "./settings.types";

export async function uploadIdentityReferenceFile(file: File): Promise<Profile> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Choose a JPG, PNG, or WebP image.");
  }
  if (!file.size || file.size > 20 * 1024 * 1024) {
    throw new Error("Choose an image smaller than 20 MB.");
  }
  const signed = await requestJson<SignedUpload>("/api/uploads/sign", {
    method: "POST",
    body: JSON.stringify({
      purpose: "profile-reference",
      fileName: file.name || "identity-reference.jpg",
      contentType: file.type,
      fileSize: file.size,
    }),
  });
  if (file.size > signed.maximumFileSize || signed.requiredContentType !== file.type) {
    throw new Error("The selected file does not match the signed upload requirements.");
  }
  const supabase = createClient();
  const { error: uploadError } = await supabase.storage
    .from(signed.bucket)
    .uploadToSignedUrl(signed.path, signed.token, file, {
      contentType: signed.requiredContentType,
    });
  if (uploadError) throw new Error("The private image upload failed. Please try again.");

  return requestJson<Profile>("/api/profile", {
    method: "PATCH",
    body: JSON.stringify({ identity_reference_path: signed.path }),
  });
}
