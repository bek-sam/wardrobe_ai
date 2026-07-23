import { useState } from "react";

import type { WardrobeItem } from "@/features/wardrobe/types";

import { useWardrobeFilters } from "./use-wardrobe-filters";
import { useWardrobeItemActions } from "./use-wardrobe-item-actions";
import { useWardrobeItems } from "./use-wardrobe-items";
import { useWardrobeSort } from "./use-wardrobe-sort";

export function useWardrobeManagerState(configured: boolean) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WardrobeItem | null>(null);

  const filterState = useWardrobeFilters();
  const itemsState = useWardrobeItems(configured, filterState.filters);
  const sortState = useWardrobeSort(itemsState.items);
  const actions = useWardrobeItemActions(
    itemsState.setItems,
    itemsState.setTotal,
    itemsState.setError,
    filterState.filters.availability,
    filterState.filters.favoritesOnly,
  );

  function openForm(item: WardrobeItem | null) {
    setEditingItem(item);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingItem(null);
  }

  return {
    viewMode,
    setViewMode,
    formOpen,
    editingItem,
    openForm,
    closeForm,
    ...filterState,
    ...itemsState,
    ...sortState,
    actions,
  };
}
