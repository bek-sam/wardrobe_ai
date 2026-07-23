import { useMemo, useState } from "react";

import type { OutfitFilter, OutfitRecord } from "./outfits-manager.types";

export function useOutfitsFilterSort(outfits: OutfitRecord[], activeFilter: OutfitFilter) {
  const [search, setSearch] = useState("");
  const [occasion, setOccasion] = useState("");
  const [sort, setSort] = useState("recent");

  const occasions = useMemo(
    () =>
      [
        ...new Set(
          outfits.map((outfit) => outfit.occasion).filter((value): value is string => !!value),
        ),
      ].sort((first, second) => first.localeCompare(second)),
    [outfits],
  );

  const visibleOutfits = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const next = outfits.filter((outfit) => {
      if (activeFilter === "favorite" && !outfit.favorite) return false;
      if (activeFilter === "worn" && !outfit.wear_logs?.length) return false;
      if (occasion && outfit.occasion !== occasion) return false;
      if (!normalizedSearch) return true;
      return [outfit.name, outfit.occasion, outfit.explanation]
        .filter((value): value is string => !!value)
        .some((value) => value.toLowerCase().includes(normalizedSearch));
    });
    if (sort === "name") return next.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "favorite") return next.sort((a, b) => Number(b.favorite) - Number(a.favorite));
    return next.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [activeFilter, occasion, outfits, search, sort]);

  return { search, setSearch, occasion, setOccasion, sort, setSort, occasions, visibleOutfits };
}
