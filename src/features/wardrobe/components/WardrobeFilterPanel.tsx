import { Button } from "@/components/ui/Button";

import { WardrobeFilterAvailabilityStatus } from "./WardrobeFilterAvailabilityStatus";
import { WardrobeFilterSelects } from "./WardrobeFilterSelects";
import { WardrobeFilterTextInputs } from "./WardrobeFilterTextInputs";
import type { WardrobeFilters } from "./wardrobe-manager.types";

export function WardrobeFilterPanel({
  filters,
  setFilter,
  onClearAdvanced,
}: {
  filters: WardrobeFilters;
  setFilter: <Key extends keyof WardrobeFilters>(key: Key, value: WardrobeFilters[Key]) => void;
  onClearAdvanced: () => void;
}) {
  return (
    <div className="wardrobe-filter-panel">
      <WardrobeFilterAvailabilityStatus
        availability={filters.availability}
        itemStatus={filters.itemStatus}
        onAvailability={(value) => setFilter("availability", value)}
        onItemStatus={(value) => setFilter("itemStatus", value)}
      />
      <WardrobeFilterTextInputs
        brand={filters.brand}
        color={filters.color}
        onBrand={(value) => setFilter("brand", value)}
        onColor={(value) => setFilter("color", value)}
      />
      <WardrobeFilterSelects
        formality={filters.formality}
        occasion={filters.occasion}
        onFormality={(value) => setFilter("formality", value)}
        onOccasion={(value) => setFilter("occasion", value)}
        onSeason={(value) => setFilter("season", value)}
        season={filters.season}
      />
      <label className="check-row wardrobe-filter-panel__check">
        <input
          checked={filters.favoritesOnly}
          onChange={(event) => setFilter("favoritesOnly", event.target.checked)}
          type="checkbox"
        />
        Favorites only
      </label>
      <Button onClick={onClearAdvanced} variant="ghost">
        Clear filters
      </Button>
    </div>
  );
}
