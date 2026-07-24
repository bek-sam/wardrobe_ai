import type { UploadPurpose } from "@/features/uploads/schemas";
import { getServerEnvironment } from "@/lib/env/server";

export function bucketForPurpose(purpose: UploadPurpose) {
  const environment = getServerEnvironment();
  return {
    "wardrobe-original": environment.WARDROBE_ORIGINALS_BUCKET,
    "wardrobe-item": environment.WARDROBE_ITEMS_BUCKET,
    "wardrobe-label": environment.WARDROBE_LABELS_BUCKET,
    "profile-reference": environment.PROFILE_REFERENCES_BUCKET,
  }[purpose];
}
