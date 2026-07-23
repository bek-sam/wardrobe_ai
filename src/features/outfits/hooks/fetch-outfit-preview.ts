export async function fetchOutfitPreviewUrl(
  candidateId: string,
  signal: AbortSignal,
): Promise<string | null> {
  const response = await fetch(`/api/outfit-candidates/${candidateId}/preview`, { signal });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || !("data" in payload)) return null;
  const data = payload.data as { previewUrl: string | null };
  return data.previewUrl ?? null;
}

export async function requestOutfitPreview(candidateId: string): Promise<string> {
  const response = await fetch(`/api/outfit-candidates/${candidateId}/preview`, { method: "POST" });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || !("data" in payload)) {
    const message = payload && "error" in payload ? payload.error?.message : null;
    throw new Error(message ?? "The preview could not be requested.");
  }
  const data = payload.data as { status: string };
  return data.status === "already_fresh"
    ? "A preview is already ready."
    : "Preview requested — this can take a minute. Check back shortly.";
}
