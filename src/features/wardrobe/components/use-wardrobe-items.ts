import { useEffect, useState } from "react";

import { requestJson } from "@/lib/api/request";

import { buildWardrobeQuery } from "./wardrobe-query-params";
import type {
  LiveWardrobeItem,
  WardrobeFilters,
  WardrobeListResponse,
} from "./wardrobe-manager.types";

export function useWardrobeItems(configured: boolean, filters: WardrobeFilters) {
  const [items, setItems] = useState<LiveWardrobeItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!configured) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const query = buildWardrobeQuery(filters);
        const result = await requestJson<WardrobeListResponse>(`/api/items?${query}`, {
          signal: controller.signal,
        });
        setItems(result.items);
        setTotal(result.count);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setError(caught instanceof Error ? caught.message : "The wardrobe could not be loaded.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [configured, filters, retry]);

  return { items, setItems, total, setTotal, loading, error, setError, retry, setRetry };
}
