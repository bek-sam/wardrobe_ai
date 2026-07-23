import { useEffect, useMemo, useState } from "react";

import { loadInsights } from "./load-insights";
import type { Insights } from "./insights.types";

export function useInsights(configured: boolean) {
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!configured) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      loadInsights(controller.signal)
        .then(setInsights)
        .catch((caught) => {
          if (caught instanceof DOMException && caught.name === "AbortError") return;
          setError(
            caught instanceof Error ? caught.message : "Wardrobe insights could not be loaded.",
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
  }, [configured, retry]);

  const costSummary = useMemo(() => {
    if (!insights?.costPerWear.length) return null;
    const currency = insights.costPerWear[0]?.currency;
    if (!currency || insights.costPerWear.some((entry) => entry.currency !== currency)) return null;
    const average =
      insights.costPerWear.reduce((sum, entry) => sum + entry.value, 0) /
      insights.costPerWear.length;
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(average);
    } catch {
      return `${average.toFixed(2)} ${currency}`;
    }
  }, [insights]);

  return { insights, loading, error, retry, setRetry, costSummary };
}
