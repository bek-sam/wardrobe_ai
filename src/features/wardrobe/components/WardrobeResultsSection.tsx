import { WardrobeEmptyState } from "./WardrobeEmptyState";
import { WardrobeGridSkeleton } from "./WardrobeGridSkeleton";
import { WardrobeLiveGrid } from "./WardrobeLiveGrid";
import type { WardrobeResultsSectionProps } from "./wardrobe-manager.types";

export function WardrobeResultsSection({
  loading,
  items,
  listView,
  hasQuery,
  busyItemId,
  onEdit,
  onFavorite,
  onAvailability,
  onDelete,
  onClearAllFilters,
  onAddManually,
}: WardrobeResultsSectionProps) {
  if (loading) return <WardrobeGridSkeleton listView={listView} />;
  if (!items.length) {
    return (
      <WardrobeEmptyState
        hasQuery={hasQuery}
        onAddManually={onAddManually}
        onClearAllFilters={onClearAllFilters}
      />
    );
  }
  return (
    <WardrobeLiveGrid
      busyItemId={busyItemId}
      items={items}
      listView={listView}
      onAvailability={onAvailability}
      onDelete={onDelete}
      onEdit={onEdit}
      onFavorite={onFavorite}
    />
  );
}
