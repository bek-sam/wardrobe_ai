import { useCallback, useEffect, useState } from "react";

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

type LocalPreview = { candidateId: string; status: string; notice: string | null };

export function useOutfitPreview(candidateId: string | null, status: string | null) {
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewRequestBusy, setPreviewRequestBusy] = useState(false);
  // `status` describes the recommendation as it was generated. Processing moves
  // it forward from here and nothing re-fetches the recommendation, so what was
  // observed locally wins -- but it is tagged with the candidate it belongs to,
  // which is what stops a stale status leaking onto the next recommendation.
  const [local, setLocal] = useState<LocalPreview | null>(null);
  const current = local && local.candidateId === candidateId ? local : null;
  const previewStatus = current?.status ?? status;
  const previewNotice = current?.notice ?? null;

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setPreviewImageUrl(null);
      if (!candidateId || previewStatus !== "ready") return;
      try {
        setPreviewImageUrl(await fetchOutfitPreviewUrl(candidateId, controller.signal));
      } catch {
        // A failed fetch just means no image renders.
      }
    })();
    return () => controller.abort();
  }, [candidateId, previewStatus]);

  const requestPreview = useCallback(async () => {
    if (!candidateId) return;
    setPreviewRequestBusy(true);
    setLocal({ candidateId, status: "queued", notice: null });
    try {
      // Enqueue *and* process. Enqueuing alone leaves the job for a scheduler
      // that need not exist, which stranded the card on "generating…" with no
      // control to retry; the stylist path already pairs the two calls.
      const result = await requestAndProcessPreview(candidateId);
      setLocal({ candidateId, status: result.status, notice: result.notice });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "The preview could not be requested.";
      setLocal({ candidateId, status: "failed", notice: message });
    } finally {
      setPreviewRequestBusy(false);
    }
  }, [candidateId]);

  return { previewImageUrl, previewStatus, previewRequestBusy, previewNotice, requestPreview };
}
