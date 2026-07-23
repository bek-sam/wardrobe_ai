export function validateImportFile(file: File): string | null {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return "Choose a JPG, PNG, or WebP image.";
  }
  if (!file.size || file.size > 20 * 1024 * 1024) {
    return "Choose an image smaller than 20 MB.";
  }
  return null;
}
