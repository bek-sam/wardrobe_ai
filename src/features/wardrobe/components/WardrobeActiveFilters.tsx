import { AVAILABILITY_OPTIONS } from "@/features/wardrobe/constants";
import type { AvailabilityStatus } from "@/features/wardrobe/types";

export function WardrobeActiveFilters({
  availability,
  favoritesOnly,
  onClearAvailability,
  onClearFavorites,
  onClearAll,
}: {
  availability: AvailabilityStatus | "";
  favoritesOnly: boolean;
  onClearAvailability: () => void;
  onClearFavorites: () => void;
  onClearAll: () => void;
}) {
  return (
    <div className="active-filters">
      {availability ? (
        <span>
          {AVAILABILITY_OPTIONS.find((option) => option.value === availability)?.label}
          <button
            aria-label="Remove availability filter"
            onClick={onClearAvailability}
            type="button"
          >
            ×
          </button>
        </span>
      ) : null}
      {favoritesOnly ? (
        <span>
          Favorites
          <button aria-label="Remove favorites filter" onClick={onClearFavorites} type="button">
            ×
          </button>
        </span>
      ) : null}
      <button onClick={onClearAll} type="button">
        Clear all
      </button>
    </div>
  );
}
