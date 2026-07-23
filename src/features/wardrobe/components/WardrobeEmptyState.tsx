import { Plus } from "@phosphor-icons/react";

import { Button } from "@/components/ui/Button";

export function WardrobeEmptyState({
  hasQuery,
  onClearAllFilters,
  onAddManually,
}: {
  hasQuery: boolean;
  onClearAllFilters: () => void;
  onAddManually: () => void;
}) {
  return (
    <section className="empty-state">
      <span className="empty-state__icon">
        <Plus size={24} />
      </span>
      <h2>{hasQuery ? "No matching pieces" : "Your wardrobe is ready"}</h2>
      <p>
        {hasQuery
          ? "Try clearing a filter or searching with a different garment name."
          : "Add a piece manually, or import a photo and review every detected garment before saving."}
      </p>
      <div className="empty-state__action">
        {hasQuery ? (
          <Button onClick={onClearAllFilters} variant="secondary">
            Clear filters
          </Button>
        ) : (
          <Button onClick={onAddManually}>
            <Plus size={16} /> Add first piece
          </Button>
        )}
      </div>
    </section>
  );
}
