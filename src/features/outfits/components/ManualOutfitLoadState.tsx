import { Plus, SpinnerGap, WarningCircle } from "@phosphor-icons/react";

import { Button, ButtonLink } from "@/components/ui/Button";

export function ManualOutfitLoadState({
  loading,
  error,
  hasItems,
  onRetry,
}: {
  loading: boolean;
  error: string | null;
  hasItems: boolean;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <div className="inline-feedback" role="status">
        <SpinnerGap className="spin" size={17} />
        <span>Loading available wardrobe pieces…</span>
      </div>
    );
  }
  if (error && !hasItems) {
    return (
      <div className="inline-feedback inline-feedback--error" role="alert">
        <WarningCircle size={17} />
        <span>{error}</span>
        <Button onClick={onRetry} variant="ghost">
          Try again
        </Button>
      </div>
    );
  }
  if (!hasItems) {
    return (
      <section className="empty-state outfit-builder-empty">
        <span className="empty-state__icon">
          <Plus size={24} />
        </span>
        <h2>No available pieces yet</h2>
        <p>Add active wardrobe items and mark them available before building an outfit.</p>
        <div className="empty-state__action">
          <ButtonLink href="/wardrobe">Manage wardrobe</ButtonLink>
        </div>
      </section>
    );
  }
  return null;
}
