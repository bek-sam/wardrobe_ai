import { FilterSelectField } from "./FilterSelectField";
import {
  FORMALITY_OPTIONS,
  OCCASION_OPTIONS,
  SEASON_OPTIONS,
} from "./wardrobe-filter-options.data";

export function WardrobeFilterSelects({
  season,
  onSeason,
  occasion,
  onOccasion,
  formality,
  onFormality,
}: {
  season: string;
  onSeason: (value: string) => void;
  occasion: string;
  onOccasion: (value: string) => void;
  formality: string;
  onFormality: (value: string) => void;
}) {
  return (
    <>
      <FilterSelectField
        label="Season"
        onChange={onSeason}
        options={SEASON_OPTIONS}
        placeholder="Any season"
        value={season}
      />
      <FilterSelectField
        label="Occasion"
        onChange={onOccasion}
        options={OCCASION_OPTIONS}
        placeholder="Any occasion"
        value={occasion}
      />
      <FilterSelectField
        label="Formality"
        onChange={onFormality}
        options={FORMALITY_OPTIONS}
        placeholder="Any level"
        value={formality}
      />
    </>
  );
}
