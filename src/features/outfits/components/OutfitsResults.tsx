import { SpinnerGap } from "@phosphor-icons/react";

import { OutfitsEmptyState } from "./OutfitsEmptyState";
import { OutfitsGrid } from "./OutfitsGrid";
import type { useOutfitsManagerState } from "./use-outfits-manager-state";

export function OutfitsResults({ state }: { state: ReturnType<typeof useOutfitsManagerState> }) {
  if (state.loading) {
    return (
      <div className="inline-feedback" role="status">
        <SpinnerGap className="spin" size={17} />
        <span>Loading saved outfits…</span>
      </div>
    );
  }
  if (!state.visibleOutfits.length) {
    return (
      <OutfitsEmptyState
        hasQuery={Boolean(state.search || state.occasion)}
        onBuildManually={() => state.setBuilderOpen(true)}
        onClearFilters={() => {
          state.setSearch("");
          state.setOccasion("");
        }}
      />
    );
  }
  return <OutfitsGrid actions={state.actions} outfits={state.visibleOutfits} />;
}
