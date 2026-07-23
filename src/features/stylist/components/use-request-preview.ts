import { requestAndProcessPreview } from "@/features/outfits/hooks/request-and-process-preview";

import type { usePreviewOverrides } from "./use-preview-overrides";

export function useRequestPreview(
  candidateId: string | null,
  overrides: ReturnType<typeof usePreviewOverrides>,
  setBusy: (value: boolean) => void,
) {
  return async function requestPreview() {
    if (!candidateId) return;
    setBusy(true);
    overrides.setNotice(null);
    overrides.setLocalStatus("queued");
    try {
      const result = await requestAndProcessPreview(candidateId);
      overrides.setLocalStatus(result.status);
      overrides.setNotice(result.notice);
    } catch (previewError) {
      overrides.setLocalStatus("failed");
      overrides.setNotice(
        previewError instanceof Error
          ? previewError.message
          : "The preview could not be requested.",
      );
    } finally {
      setBusy(false);
    }
  };
}
