import { ApiError } from "@/lib/api/response";
import { validateAndNormalizeImage } from "@/lib/image/validation";

const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_MANUAL_IMAGE_BYTES = 4 * 1024 * 1024;

export async function validateUploadedImage(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0 || !ACCEPTED_TYPES.has(file.type)) {
    throw new ApiError(422, "invalid_image", "Choose a JPEG, PNG, or WebP wardrobe image.");
  }
  if (file.size > MAX_MANUAL_IMAGE_BYTES) {
    throw new ApiError(
      413,
      "image_too_large",
      "Manual images must be 4 MB or smaller. Use photo import for larger images.",
    );
  }

  try {
    return await validateAndNormalizeImage(Buffer.from(await file.arrayBuffer()));
  } catch (error) {
    throw new ApiError(
      422,
      "invalid_image",
      error instanceof Error ? error.message : "The image could not be decoded safely.",
    );
  }
}
