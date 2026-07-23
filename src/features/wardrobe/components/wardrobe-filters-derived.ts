import type { WardrobeFilters } from "./wardrobe-manager.types";

export function activeFilterCount(filters: WardrobeFilters): number {
  return (
    Number(Boolean(filters.availability)) +
    Number(filters.itemStatus !== "active") +
    Number(Boolean(filters.brand.trim())) +
    Number(Boolean(filters.color.trim())) +
    Number(Boolean(filters.season)) +
    Number(Boolean(filters.occasion)) +
    Number(Boolean(filters.formality)) +
    Number(filters.favoritesOnly)
  );
}

export function hasActiveQuery(filters: WardrobeFilters): boolean {
  return Boolean(
    filters.search.trim() ||
    filters.category ||
    filters.availability ||
    filters.itemStatus !== "active" ||
    filters.brand.trim() ||
    filters.color.trim() ||
    filters.season ||
    filters.occasion ||
    filters.formality ||
    filters.favoritesOnly,
  );
}
