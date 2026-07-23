import { useEffect, useMemo, useState } from "react";

import { requestJson } from "@/lib/api/request";

import { groupItemsByRole } from "./group-items-by-role";
import type { LiveWardrobeItem, WardrobeListResponse } from "./outfits-manager.types";

export function useAvailableWardrobeItems(onLoaded: (items: LiveWardrobeItem[]) => void) {
  const [items, setItems] = useState<LiveWardrobeItem[]>([]);
  const [availableCount, setAvailableCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      requestJson<WardrobeListResponse>(
        "/api/items?status=active&availability=available&limit=100",
        {
          signal: controller.signal,
        },
      )
        .then((result) => {
          setItems(result.items);
          setAvailableCount(result.count);
          onLoaded(result.items);
        })
        .catch((caught) => {
          if (caught instanceof DOMException && caught.name === "AbortError") return;
          setError(
            caught instanceof Error ? caught.message : "Available wardrobe items could not load.",
          );
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 0);
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retry]);

  const itemsByRole = useMemo(() => groupItemsByRole(items), [items]);

  return { items, availableCount, itemsByRole, loading, error, setRetry };
}
