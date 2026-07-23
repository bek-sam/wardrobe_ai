import { MagnifyingGlass } from "@phosphor-icons/react";

export function PreviewOutfitsToolbar() {
  return (
    <div className="outfit-toolbar" aria-disabled="true">
      <label>
        <MagnifyingGlass size={17} />
        <span className="sr-only">Search preview outfits</span>
        <input disabled placeholder="Search outfits" type="search" />
      </label>
      <select aria-label="Preview occasion filter" disabled>
        <option>All occasions</option>
      </select>
      <select aria-label="Preview outfit sorting" disabled>
        <option>Recently saved</option>
      </select>
    </div>
  );
}
