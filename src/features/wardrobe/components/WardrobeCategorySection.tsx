import { hasActiveQuery } from "./wardrobe-filters-derived";
import { WardrobeActiveFilters } from "./WardrobeActiveFilters";
import { WardrobeCategoryTabs } from "./WardrobeCategoryTabs";
import type { WardrobeFilters } from "./wardrobe-manager.types";

export function WardrobeCategorySection({
  filters,
  setFilter,
  clearAllFilters,
  total,
}: {
  filters: WardrobeFilters;
  setFilter: <Key extends keyof WardrobeFilters>(key: Key, value: WardrobeFilters[Key]) => void;
  clearAllFilters: () => void;
  total: number;
}) {
  const hasQuery = hasActiveQuery(filters);
  return (
    <>
      <WardrobeCategoryTabs
        category={filters.category}
        hasQuery={hasQuery}
        onCategory={(value) => setFilter("category", value)}
        total={total}
      />
      {hasQuery ? (
        <WardrobeActiveFilters
          availability={filters.availability}
          favoritesOnly={filters.favoritesOnly}
          onClearAll={clearAllFilters}
          onClearAvailability={() => setFilter("availability", "")}
          onClearFavorites={() => setFilter("favoritesOnly", false)}
        />
      ) : null}
    </>
  );
}
