import { useState } from "react";

import { defaultFilters } from "./wardrobe-manager.constants";
import type { WardrobeFilters } from "./wardrobe-manager.types";

export function useWardrobeFilters() {
  const [filters, setFilters] = useState<WardrobeFilters>(defaultFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);

  function setFilter<Key extends keyof WardrobeFilters>(key: Key, value: WardrobeFilters[Key]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function clearAdvancedFilters() {
    setFilters((current) => ({
      ...defaultFilters,
      search: current.search,
      category: current.category,
    }));
  }

  function clearAllFilters() {
    setFilters(defaultFilters);
  }

  return { filters, setFilter, filtersOpen, setFiltersOpen, clearAdvancedFilters, clearAllFilters };
}
