import { ManualOutfitDialogHeader } from "./ManualOutfitDialogHeader";
import { ManualOutfitForm } from "./ManualOutfitForm";
import { ManualOutfitLoadState } from "./ManualOutfitLoadState";
import { useManualOutfitDialog } from "./use-manual-outfit-dialog";
import type { OutfitRecord } from "./outfits-manager.types";

export function ManualOutfitDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (outfit: OutfitRecord) => void;
}) {
  const state = useManualOutfitDialog(onSaved);
  const closeSafely = () => {
    if (!state.form.saving) onClose();
  };

  return (
    <div className="dialog-backdrop" onMouseDown={closeSafely} role="presentation">
      <section
        aria-labelledby="manual-outfit-title"
        aria-modal="true"
        className="item-form-dialog outfit-builder-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <ManualOutfitDialogHeader disabled={state.form.saving} onClose={closeSafely} />
        <ManualOutfitLoadState
          error={state.wardrobe.error}
          hasItems={state.wardrobe.items.length > 0}
          loading={state.wardrobe.loading}
          onRetry={() => state.wardrobe.setRetry((value) => value + 1)}
        />
        {!state.wardrobe.loading && state.wardrobe.items.length > 0 ? (
          <ManualOutfitForm onClose={closeSafely} state={state} />
        ) : null}
      </section>
    </div>
  );
}
