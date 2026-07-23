import { useCallback, useEffect, useMemo, useState } from "react";

import { requestJson } from "@/lib/api/request";

import { ACCEPTABLE_RESEARCH_FIELDS } from "./acceptable-research-fields.data";
import type { ItemDetail, ItemEditValues, ResearchRun } from "./item-detail.types";

export function useItemDetailData(itemId: string) {
  const [item, setItem] = useState<ItemDetail | null>(null);
  const [research, setResearch] = useState<ResearchRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<ItemEditValues>({
    name: "",
    brand: "",
    category: "",
    notes: "",
  });

  const load = useCallback(async () => {
    try {
      const [nextItem, runs] = await Promise.all([
        requestJson<ItemDetail>(`/api/items/${encodeURIComponent(itemId)}`),
        requestJson<ResearchRun[]>(`/api/items/${encodeURIComponent(itemId)}/research`),
      ]);
      setItem(nextItem);
      setResearch(runs);
      setEditValues({
        name: nextItem.name,
        brand: nextItem.brand ?? "",
        category: nextItem.category,
        notes: nextItem.notes,
      });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "This wardrobe item could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const latestResearch = research[0] ?? null;
  const researchFields = useMemo(
    () =>
      latestResearch
        ? Object.keys(latestResearch.proposed_changes).filter((field) =>
            ACCEPTABLE_RESEARCH_FIELDS.has(field),
          )
        : [],
    [latestResearch],
  );

  return {
    item,
    setItem,
    latestResearch,
    researchFields,
    loading,
    error,
    setError,
    editValues,
    setEditValues,
    load,
  };
}
