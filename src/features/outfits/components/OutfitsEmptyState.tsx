import { Plus, Sparkle } from "@phosphor-icons/react";

import { Button, ButtonLink } from "@/components/ui/Button";

export function OutfitsEmptyState({
  hasQuery,
  onClearFilters,
  onBuildManually,
}: {
  hasQuery: boolean;
  onClearFilters: () => void;
  onBuildManually: () => void;
}) {
  return (
    <section className="empty-state">
      <span className="empty-state__icon">
        <Sparkle size={25} weight="light" />
      </span>
      <h2>{hasQuery ? "No matching outfits" : "No saved outfits yet"}</h2>
      <p>
        {hasQuery
          ? "Try another search or clear the occasion filter."
          : "Ask the stylist for a look made only from your saved, available wardrobe items."}
      </p>
      <div className="empty-state__action">
        {hasQuery ? (
          <Button onClick={onClearFilters} variant="secondary">
            Clear filters
          </Button>
        ) : (
          <div className="outfit-empty-actions">
            <Button onClick={onBuildManually} variant="secondary">
              <Plus size={16} /> Build manually
            </Button>
            <ButtonLink href="/stylist">Open the stylist</ButtonLink>
          </div>
        )}
      </div>
    </section>
  );
}
