"use client";

import type { WardrobeItem } from "@/features/wardrobe/types";

import { ItemFormDialogHeader } from "./ItemFormDialogHeader";
import { ItemFormFields } from "./ItemFormFields";
import { ItemFormFooter } from "./ItemFormFooter";
import { useItemForm } from "./use-item-form";

export function ItemFormDialog({
  item,
  onClose,
  onSaved,
  onWarning,
}: {
  item: WardrobeItem | null;
  onClose: () => void;
  onSaved: (item: WardrobeItem) => void;
  onWarning: (message: string) => void;
}) {
  const { values, setField, saving, error, setImage, editing, submit } = useItemForm(
    item,
    onSaved,
    onWarning,
  );

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-labelledby="item-form-title"
        aria-modal="true"
        className="item-form-dialog"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <ItemFormDialogHeader editing={editing} onClose={onClose} />
        <form className="form-grid" onSubmit={submit}>
          <ItemFormFields onImage={setImage} setField={setField} values={values} />
          <ItemFormFooter
            canSubmit={Boolean(values.name.trim())}
            editing={editing}
            error={error}
            onClose={onClose}
            saving={saving}
          />
        </form>
      </section>
    </div>
  );
}
