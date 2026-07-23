import { hasActiveQuery } from "./wardrobe-filters-derived";
import { WardrobeErrorBanner } from "./WardrobeErrorBanner";
import { WardrobeResultsHeader } from "./WardrobeResultsHeader";
import { WardrobeResultsSection } from "./WardrobeResultsSection";
import type { useWardrobeManagerState } from "./use-wardrobe-manager-state";

export function WardrobeManagerResults({
  state,
}: {
  state: ReturnType<typeof useWardrobeManagerState>;
}) {
  return (
    <>
      <WardrobeResultsHeader
        configured
        loading={state.loading}
        onSort={state.setSort}
        sort={state.sort}
        total={state.total}
      />
      {state.error ? (
        <WardrobeErrorBanner
          error={state.error}
          onRetry={() => state.setRetry((value) => value + 1)}
        />
      ) : null}
      <WardrobeResultsSection
        busyItemId={state.actions.busyItemId}
        hasQuery={hasActiveQuery(state.filters)}
        items={state.sortedItems}
        listView={state.viewMode === "list"}
        loading={state.loading}
        onAddManually={() => state.openForm(null)}
        onAvailability={(item, next) => state.actions.setAvailability(item.id, next)}
        onClearAllFilters={state.clearAllFilters}
        onDelete={state.actions.deleteItem}
        onEdit={state.openForm}
        onFavorite={state.actions.toggleFavorite}
      />
    </>
  );
}
