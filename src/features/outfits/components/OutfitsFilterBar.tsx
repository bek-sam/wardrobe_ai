import { OutfitsToolbar } from "./OutfitsToolbar";
import { OutfitTabs } from "./OutfitTabs";
import type { useOutfitsManagerState } from "./use-outfits-manager-state";

export function OutfitsFilterBar({ state }: { state: ReturnType<typeof useOutfitsManagerState> }) {
  return (
    <>
      <OutfitTabs
        activeFilter={state.activeFilter}
        onChange={state.setActiveFilter}
        total={state.total}
      />
      <OutfitsToolbar
        occasion={state.occasion}
        occasions={state.occasions}
        onOccasion={state.setOccasion}
        onSearch={state.setSearch}
        onSort={state.setSort}
        search={state.search}
        sort={state.sort}
      />
    </>
  );
}
