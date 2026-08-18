export async function uploadSignedFile(
  signedUrl: string,
  file: File,
  contentType: string,
): Promise<void> {
  const response = await fetch(signedUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "max-age=3600",
      "X-Upsert": "false",
    },
    body: file,
  });
  if (!response.ok) throw new Error("The private image upload failed. Please try again.");
}
