import { useCallback, useEffect, useState } from "react";

import { fetchOutfitPreviewUrl, requestOutfitPreview } from "./fetch-outfit-preview";

export function useOutfitPreview(candidateId: string | null, status: string | null) {
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewRequestBusy, setPreviewRequestBusy] = useState(false);
  const [previewNotice, setPreviewNotice] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setPreviewImageUrl(null);
      setPreviewNotice(null);
      if (!candidateId || status !== "ready") return;
      try {
        setPreviewImageUrl(await fetchOutfitPreviewUrl(candidateId, controller.signal));
      } catch {
        // A failed fetch just means no image renders.
      }
    })();
    return () => controller.abort();
  }, [candidateId, status]);

  const requestPreview = useCallback(async () => {
    if (!candidateId) return;
    setPreviewRequestBusy(true);
    setPreviewNotice(null);
    try {
      setPreviewNotice(await requestOutfitPreview(candidateId));
    } catch (error) {
      setPreviewNotice(
        error instanceof Error ? error.message : "The preview could not be requested.",
      );
    } finally {
      setPreviewRequestBusy(false);
    }
  }, [candidateId]);

  return { previewImageUrl, previewRequestBusy, previewNotice, requestPreview };
}
