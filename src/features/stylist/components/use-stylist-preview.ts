import { useEffect, useState } from "react";

import { fetchOutfitPreviewUrl } from "@/features/outfits/hooks/fetch-outfit-preview";

import { usePreviewOverrides } from "./use-preview-overrides";
import { useRequestPreview } from "./use-request-preview";
import type { Recommendation } from "./stylist.types";

export function useStylistPreview(recommendation: Recommendation | null) {
  const candidateId = recommendation?.preview?.candidateId ?? null;
  const overrides = usePreviewOverrides(candidateId);
  const status = overrides.localStatus ?? recommendation?.preview?.status ?? null;
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewRequestBusy, setPreviewRequestBusy] = useState(false);
  const requestPreview = useRequestPreview(candidateId, overrides, setPreviewRequestBusy);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setPreviewImageUrl(null);
      if (!candidateId || status !== "ready") return;
      try {
        setPreviewImageUrl(await fetchOutfitPreviewUrl(candidateId, controller.signal));
      } catch {
        // A failed fetch just means no image renders; the rest of the recommendation is unaffected.
      }
    })();
    return () => controller.abort();
  }, [candidateId, status]);

  return {
    previewStatus: status,
    previewImageUrl,
    previewRequestBusy,
    previewNotice: overrides.notice,
    requestPreview,
  };
}
