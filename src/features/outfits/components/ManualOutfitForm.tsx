import { ManualOutfitFoundationSection } from "./ManualOutfitFoundationSection";
import { ManualOutfitFooter } from "./ManualOutfitFooter";
import { ManualOutfitNameOccasionFields } from "./ManualOutfitNameOccasionFields";
import { ManualOutfitNotes } from "./ManualOutfitNotes";
import { ManualOutfitNotesField } from "./ManualOutfitNotesField";
import type { useManualOutfitDialog } from "./use-manual-outfit-dialog";

export function ManualOutfitForm({
  state,
  onClose,
}: {
  state: ReturnType<typeof useManualOutfitDialog>;
  onClose: () => void;
}) {
  const { wardrobe, selections, form, validationMessage } = state;
  return (
    <form className="form-grid" onSubmit={(event) => void form.submit(event, validationMessage)}>
      <ManualOutfitNameOccasionFields
        name={form.name}
        occasion={form.occasion}
        onName={form.setName}
        onOccasion={form.setOccasion}
        saving={form.saving}
      />
      <ManualOutfitFoundationSection state={state} />
      <ManualOutfitNotesField
        explanation={form.explanation}
        favorite={form.favorite}
        onExplanation={form.setExplanation}
        onFavorite={form.setFavorite}
        saving={form.saving}
      />
      <ManualOutfitNotes
        availableCount={wardrobe.availableCount}
        error={form.error}
        itemsCount={wardrobe.items.length}
        unresolvedCount={selections.unresolvedCount}
        validationMessage={validationMessage}
      />
      <ManualOutfitFooter
        onCancel={onClose}
        saving={form.saving}
        validationMessage={validationMessage}
      />
    </form>
  );
}
