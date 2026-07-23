import { useEffect, type MutableRefObject } from "react";

export function useClearPreviewOnJobImage({
  originalImageUrl,
  localPreviewRef,
  clearLocalPreview,
}: {
  originalImageUrl: string | null | undefined;
  localPreviewRef: MutableRefObject<string | null>;
  clearLocalPreview: () => void;
}) {
  useEffect(() => {
    if (originalImageUrl && localPreviewRef.current) clearLocalPreview();
  }, [clearLocalPreview, localPreviewRef, originalImageUrl]);
}
