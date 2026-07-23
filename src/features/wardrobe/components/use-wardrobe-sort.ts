import { useMemo, useState } from "react";

import type { LiveWardrobeItem } from "./wardrobe-manager.types";

export function useWardrobeSort(items: LiveWardrobeItem[]) {
  const [sort, setSort] = useState("recent");

  const sortedItems = useMemo(() => {
    const next = [...items];
    if (sort === "name") return next.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "worn") return next.sort((a, b) => b.wear_count - a.wear_count);
    return next;
  }, [items, sort]);

  return { sort, setSort, sortedItems };
}
