import type { LiveWardrobeItem } from "./wardrobe-manager.types";

export function applyItemUpdate<K extends keyof LiveWardrobeItem>(
  items: LiveWardrobeItem[],
  id: string,
  key: K,
  value: LiveWardrobeItem[K],
  leavesFilter: boolean,
): LiveWardrobeItem[] {
  return leavesFilter
    ? items.filter((entry) => entry.id !== id)
    : items.map((entry) => (entry.id === id ? { ...entry, [key]: value } : entry));
}
