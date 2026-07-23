import { FoundationPicker } from "./FoundationPicker";
import { RoleSelectGrid } from "./RoleSelectGrid";
import { SelectedPiecesPreview } from "./SelectedPiecesPreview";
import type { useManualOutfitDialog } from "./use-manual-outfit-dialog";

export function ManualOutfitFoundationSection({
  state,
}: {
  state: ReturnType<typeof useManualOutfitDialog>;
}) {
  const { wardrobe, selections, form } = state;
  return (
    <>
      <FoundationPicker
        foundation={selections.foundation}
        onChoose={selections.chooseFoundation}
        saving={form.saving}
      />
      <RoleSelectGrid
        activeRoles={selections.activeRoles}
        foundation={selections.foundation}
        itemsByRole={wardrobe.itemsByRole}
        onSelect={(role, itemId) =>
          selections.setSelections((current) => ({ ...current, [role]: itemId }))
        }
        saving={form.saving}
        selections={selections.selections}
      />
      <SelectedPiecesPreview selectedEntries={selections.selectedEntries} />
    </>
  );
}
