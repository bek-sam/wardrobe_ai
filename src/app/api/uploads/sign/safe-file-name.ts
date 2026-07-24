export function safeFileName(fileName: string, contentType: string) {
  const base = fileName
    .normalize("NFKC")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  const expectedExtension = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  }[contentType];
  const stem = (base || "upload").replace(/\.[^.]+$/, "");
  return `${stem}.${expectedExtension}`;
}
