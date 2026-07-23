import { useEffect, useState } from "react";

import { requestJson } from "@/lib/api/request";

import type { OutfitFilter, OutfitListResponse, OutfitRecord } from "./outfits-manager.types";

export function useOutfitsFetch(configured: boolean, activeFilter: OutfitFilter) {
  const [outfits, setOutfits] = useState<OutfitRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!configured) return;
    const controller = new AbortController();
    const query = new URLSearchParams({ limit: "100" });
    if (activeFilter === "favorite") query.set("favorite", "true");
    if (activeFilter === "worn") query.set("worn", "true");
    if (activeFilter === "ai") query.set("source", "ai");
    const timeout = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      requestJson<OutfitListResponse>(`/api/outfits?${query}`, { signal: controller.signal })
        .then((result) => {
          setOutfits(result.outfits);
          setTotal(result.count);
        })
        .catch((caught) => {
          if (caught instanceof DOMException && caught.name === "AbortError") return;
          setError(caught instanceof Error ? caught.message : "Your outfits could not be loaded.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 0);
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [activeFilter, configured, retry]);

  return { outfits, setOutfits, total, setTotal, loading, error, setError, retry, setRetry };
}
