import { activeFilterCount } from "./wardrobe-filters-derived";
import { WardrobeCategorySection } from "./WardrobeCategorySection";
import { WardrobeFilterPanel } from "./WardrobeFilterPanel";
import { WardrobeToolbar } from "./WardrobeToolbar";
import type { WardrobeManagerFiltersProps } from "./wardrobe-manager.types";

export function WardrobeManagerFilters({
  filters,
  setFilter,
  filtersOpen,
  setFiltersOpen,
  clearAdvancedFilters,
  clearAllFilters,
  viewMode,
  setViewMode,
  total,
}: WardrobeManagerFiltersProps) {
  return (
    <>
      <WardrobeToolbar
        activeFilterCount={activeFilterCount(filters)}
        filtersOpen={filtersOpen}
        onSearch={(value) => setFilter("search", value)}
        onToggleFilters={() => setFiltersOpen((current) => !current)}
        onViewMode={setViewMode}
        search={filters.search}
        viewMode={viewMode}
      />
      {filtersOpen ? (
        <WardrobeFilterPanel
          filters={filters}
          onClearAdvanced={clearAdvancedFilters}
          setFilter={setFilter}
        />
      ) : null}
      <WardrobeCategorySection
        clearAllFilters={clearAllFilters}
        filters={filters}
        setFilter={setFilter}
        total={total}
      />
    </>
  );
}
