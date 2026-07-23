import { MagnifyingGlass } from "@phosphor-icons/react";

import { OutfitOccasionSelect } from "./OutfitOccasionSelect";

export function OutfitsToolbar({
  search,
  onSearch,
  occasion,
  onOccasion,
  occasions,
  sort,
  onSort,
}: {
  search: string;
  onSearch: (value: string) => void;
  occasion: string;
  onOccasion: (value: string) => void;
  occasions: string[];
  sort: string;
  onSort: (value: string) => void;
}) {
  return (
    <div className="outfit-toolbar">
      <label>
        <MagnifyingGlass size={17} />
        <span className="sr-only">Search outfits</span>
        <input
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Search outfits"
          type="search"
          value={search}
        />
      </label>
      <OutfitOccasionSelect occasion={occasion} occasions={occasions} onOccasion={onOccasion} />
      <select
        aria-label="Sort outfits"
        onChange={(event) => onSort(event.target.value)}
        value={sort}
      >
        <option value="recent">Recently saved</option>
        <option value="name">Name A–Z</option>
        <option value="favorite">Favorites first</option>
      </select>
    </div>
  );
}
