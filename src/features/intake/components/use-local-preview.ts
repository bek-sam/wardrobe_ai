import { useCallback, useEffect, useRef, useState } from "react";

export function useLocalPreview() {
  const localPreviewRef = useRef<string | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);

  const clearLocalPreview = useCallback(() => {
    if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current);
    localPreviewRef.current = null;
    setLocalPreviewUrl(null);
  }, []);

  useEffect(() => clearLocalPreview, [clearLocalPreview]);

  return { localPreviewRef, localPreviewUrl, setLocalPreviewUrl, clearLocalPreview };
}
