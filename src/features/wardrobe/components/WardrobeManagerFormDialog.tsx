import { ItemFormDialog } from "./ItemFormDialog";
import type { useWardrobeManagerState } from "./use-wardrobe-manager-state";

export function WardrobeManagerFormDialog({
  state,
}: {
  state: ReturnType<typeof useWardrobeManagerState>;
}) {
  if (!state.formOpen) return null;
  return (
    <ItemFormDialog
      item={state.editingItem}
      onClose={state.closeForm}
      onSaved={() => {
        state.closeForm();
        state.setRetry((value) => value + 1);
      }}
      onWarning={state.setError}
    />
  );
}
