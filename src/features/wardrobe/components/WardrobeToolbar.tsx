import { FunnelSimple, MagnifyingGlass } from "@phosphor-icons/react";

import { Button } from "@/components/ui/Button";

import { WardrobeViewSwitch } from "./WardrobeViewSwitch";

export function WardrobeToolbar({
  search,
  onSearch,
  viewMode,
  onViewMode,
  filtersOpen,
  onToggleFilters,
  activeFilterCount,
  disabled = false,
}: {
  search: string;
  onSearch: (value: string) => void;
  viewMode: "grid" | "list";
  onViewMode: (mode: "grid" | "list") => void;
  filtersOpen: boolean;
  onToggleFilters: () => void;
  activeFilterCount: number;
  disabled?: boolean;
}) {
  return (
    <div className="wardrobe-toolbar">
      <label className="search-field">
        <MagnifyingGlass size={18} aria-hidden="true" />
        <span className="sr-only">Search wardrobe</span>
        <input
          disabled={disabled}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Search by garment name"
          type="search"
          value={search}
        />
      </label>
      <Button
        aria-expanded={filtersOpen}
        disabled={disabled}
        onClick={onToggleFilters}
        variant="secondary"
      >
        <FunnelSimple size={17} /> Filters
        {activeFilterCount ? <span className="filter-count">{activeFilterCount}</span> : null}
      </Button>
      <WardrobeViewSwitch disabled={disabled} onChange={onViewMode} viewMode={viewMode} />
    </div>
  );
}
