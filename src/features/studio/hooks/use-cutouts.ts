"use client";

import { useEffect, useState } from "react";

import { fetchItemCutouts } from "../api/studio-client";

/**
 * Signed cut-out URLs for the flat lay. Signed URLs are short-lived and never
 * persisted, so this refetches whenever the set of item IDs changes rather
 * than caching them anywhere.
 */
export function useCutouts(itemIds: readonly string[]) {
  const key = [...itemIds].sort().join(",");
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const { cutouts } = await fetchItemCutouts(key.split(","), controller.signal);
        setUrls(Object.fromEntries(cutouts.map((entry) => [entry.itemId, entry.url])));
      } catch {
        // The flat lay falls back to a labelled placeholder per garment.
      }
    })();
    return () => controller.abort();
  }, [key]);

  return urls;
}
