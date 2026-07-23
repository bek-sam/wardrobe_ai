const previewStatuses = new Set(["none", "queued", "generating", "ready", "failed"]);

type PreviewStatus = "none" | "queued" | "generating" | "ready" | "failed";

async function postPreview(candidateId: string, suffix: string): Promise<{ status: string }> {
  const response = await fetch(`/api/outfit-candidates/${candidateId}/preview${suffix}`, {
    method: "POST",
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || !("data" in payload)) {
    const message = payload && "error" in payload ? payload.error?.message : null;
    throw new Error(message ?? "The preview could not be requested.");
  }
  return payload.data as { status: string };
}

// Enqueues a preview, then immediately asks the internal worker route to
// process it, so this completes without waiting on a scheduler.
export async function requestAndProcessPreview(
  candidateId: string,
): Promise<{ status: PreviewStatus; notice: string | null }> {
  const enqueued = await postPreview(candidateId, "");
  if (enqueued.status === "already_fresh")
    return { status: "ready", notice: "A preview is already ready." };
  const processed = await postPreview(candidateId, "/process");
  const nextStatus = previewStatuses.has(processed.status)
    ? (processed.status as PreviewStatus)
    : "generating";
  const notice =
    nextStatus === "queued" || nextStatus === "generating"
      ? "Preview requested — this can take a minute. Check back shortly."
      : null;
  return { status: nextStatus, notice };
}
