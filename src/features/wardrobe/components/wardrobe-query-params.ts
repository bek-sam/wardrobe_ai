import type { WardrobeFilters } from "./wardrobe-manager.types";

export function buildWardrobeQuery(filters: WardrobeFilters): URLSearchParams {
  const query = new URLSearchParams({ limit: "100" });
  if (filters.search.trim()) query.set("search", filters.search.trim());
  if (filters.category) query.set("category", filters.category);
  if (filters.availability) query.set("availability", filters.availability);
  if (filters.itemStatus) query.set("status", filters.itemStatus);
  if (filters.brand.trim()) query.set("brand", filters.brand.trim());
  if (filters.color.trim()) query.set("color", filters.color.trim());
  if (filters.season) query.set("season", filters.season);
  if (filters.occasion) query.set("occasion", filters.occasion);
  if (filters.formality) query.set("formality", filters.formality);
  if (filters.favoritesOnly) query.set("favorite", "true");
  return query;
}
