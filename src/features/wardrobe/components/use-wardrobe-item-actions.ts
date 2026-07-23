import type { Dispatch, SetStateAction } from "react";

import type { AvailabilityStatus } from "@/features/wardrobe/types";

import { applyItemUpdate } from "./apply-item-update";
import { useWardrobeAvailabilityAction } from "./use-wardrobe-availability-action";
import { useWardrobeMutate } from "./use-wardrobe-mutate";
import type { LiveWardrobeItem } from "./wardrobe-manager.types";

export function useWardrobeItemActions(
  setItems: Dispatch<SetStateAction<LiveWardrobeItem[]>>,
  setTotal: Dispatch<SetStateAction<number>>,
  setError: Dispatch<SetStateAction<string | null>>,
  activeAvailability: AvailabilityStatus | "",
  favoritesOnly: boolean,
) {
  const { mutate, busyItemId } = useWardrobeMutate(setError);
  const setAvailability = useWardrobeAvailabilityAction(
    mutate,
    setItems,
    setTotal,
    activeAvailability,
  );

  const toggleFavorite = (item: LiveWardrobeItem) =>
    mutate<{ id: string; favorite: boolean }>(
      item.id,
      `/api/items/${item.id}/favorite`,
      { method: "POST", body: JSON.stringify({ favorite: !item.favorite }) },
      (data) => {
        const leaves = favoritesOnly && !data.favorite;
        setItems((current) => applyItemUpdate(current, data.id, "favorite", data.favorite, leaves));
        if (leaves) setTotal((current) => Math.max(0, current - 1));
      },
    );

  const deleteItem = (item: LiveWardrobeItem) => {
    if (!window.confirm(`Delete “${item.name}” and its associated images?`)) return;
    void mutate<{ deleted: true; id: string }>(
      item.id,
      `/api/items/${item.id}`,
      { method: "DELETE" },
      (data) => {
        setItems((current) => current.filter((entry) => entry.id !== data.id));
        setTotal((current) => Math.max(0, current - 1));
      },
    );
  };

  return { busyItemId, setAvailability, toggleFavorite, deleteItem };
}
